"""Facility directory + resource visibility + referral destination recommender.

Resource figures are seeded synthetic DEMO DATA unless a real HMIS feed is
connected — the API never presents them as live hospital availability.
"""
import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..database import get_db
from ..models import Facility, FacilityResource, FacilityType, Role, User
from ..schemas import (FacilityOut, FacilityResourceOut, FacilityResourceUpdate,
                       RecommendRequest, RecommendationOut)
from ..security import CurrentUser, require_roles

router = APIRouter(prefix="/facilities", tags=["facilities"])
DB = Annotated[Session, Depends(get_db)]


def _haversine_km(a: Facility, b: Facility) -> float:
    if None in (a.latitude, a.longitude, b.latitude, b.longitude):
        return 15.0  # neutral default when coordinates are unknown
    r = 6371.0
    dlat, dlon = math.radians(b.latitude - a.latitude), math.radians(b.longitude - a.longitude)
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a.latitude)) * math.cos(math.radians(b.latitude)) * math.sin(dlon / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(h)), 1)


@router.get("", response_model=list[FacilityOut], summary="Facility directory")
def list_facilities(_: CurrentUser, db: DB,
                    district: str | None = Query(None),
                    facility_type: str | None = Query(None, alias="type")):
    q = select(Facility).where(Facility.is_active.is_(True))
    if district:
        q = q.where(Facility.district == district)
    if facility_type:
        q = q.where(Facility.facility_type == FacilityType(facility_type.upper()))
    return [FacilityOut.model_validate(f) for f in db.execute(q).scalars()]


@router.get("/{facility_id}", response_model=FacilityOut, summary="Facility details")
def get_facility(facility_id: str, _: CurrentUser, db: DB):
    f = db.get(Facility, facility_id)
    if f is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Facility not found")
    return f


@router.get("/{facility_id}/resources", response_model=FacilityResourceOut,
            summary="Capacity / diagnostics / medicines snapshot (demo data)")
def get_resources(facility_id: str, _: CurrentUser, db: DB):
    if db.get(Facility, facility_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Facility not found")
    r = db.get(FacilityResource, facility_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No resource record — run seed.py")
    return r


@router.patch("/{facility_id}/resources", response_model=FacilityResourceOut,
              summary="Update facility resources (admin or facility staff)",
              dependencies=[Depends(require_roles(Role.DISTRICT_ADMIN, Role.PHC_DOCTOR,
                                                  Role.CHC_DOCTOR, Role.SPECIALIST, Role.PHC_STAFF))])
def update_resources(facility_id: str, body: FacilityResourceUpdate, user: CurrentUser, db: DB):
    if user.role != Role.DISTRICT_ADMIN and user.facility_id != facility_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only update resources of your own facility")
    r = db.get(FacilityResource, facility_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No resource record — run seed.py")
    for field in ("total_beds", "available_beds", "icu_beds", "oxygen_available", "ambulance_available",
                  "emergency_available", "cbc", "xray", "ultrasound", "medicines", "specialists",
                  "workload_level"):
        value = getattr(body, field)
        if value is not None:
            setattr(r, field, value)
    r.version += 1
    r.updated_by = user.name
    log_action(db, user, AuditAction.RESOURCE_UPDATE, "facility_resource", facility_id,
               detail={"version": r.version})
    db.commit()
    db.refresh(r)
    return r


@router.post("/recommend", response_model=list[RecommendationOut],
             summary="Recommend referral destinations (rule-scored, demo data)",
             description="Scores facilities by distance, requested capabilities, beds and workload. "
                         "Returns transparent reasons — the clinician always makes the final choice.")
def recommend(body: RecommendRequest, _: CurrentUser, db: DB):
    source = db.get(Facility, body.from_facility_id)
    if source is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source facility not found")

    results: list[RecommendationOut] = []
    for f in db.execute(select(Facility).where(Facility.is_active.is_(True),
                                               Facility.id != source.id)).scalars():
        if body.destination_types and f.facility_type.value not in body.destination_types:
            continue
        res = db.get(FacilityResource, f.id)
        distance = _haversine_km(source, f)
        score = max(0, int(100 - distance * 1.2))
        reasons = [f"{distance} km from {source.name}"]

        def need(flag: bool, ok: bool, ok_label: str, miss_label: str, gain: int, loss: int):
            nonlocal score
            if flag:
                if ok:
                    score += gain
                    reasons.append(ok_label)
                else:
                    score -= loss
                    reasons.append(miss_label)

        if res:
            need("oxygen" in body.needs, res.oxygen_available, "Oxygen available", "No oxygen supply", 15, 25)
            need("icu" in body.needs, res.icu_beds > 0, f"ICU beds: {res.icu_beds}", "No ICU beds", 15, 25)
            need("emergency" in body.needs, res.emergency_available, "Emergency department open",
                 "No emergency service", 12, 20)
            need("cbc" in body.needs, res.cbc.value == "AVAILABLE", "CBC lab available", "CBC unavailable", 6, 10)
            need("xray" in body.needs, res.xray.value == "AVAILABLE", "X-Ray available", "X-Ray unavailable", 6, 10)
            need("ultrasound" in body.needs, res.ultrasound.value == "AVAILABLE", "Ultrasound available",
                 "Ultrasound unavailable", 6, 10)
            specialties = [s for s in body.needs if s.startswith("specialty:")]
            for sp in specialties:
                name = sp.split(":", 1)[1].lower()
                has = any(str(s.get("specialty", "")).lower() == name and s.get("available") for s in res.specialists)
                need(True, has, f"{name.title()} specialist available", f"No {name} specialist", 15, 15)
            if res.available_beds <= 0:
                score -= 30
                reasons.append("No beds currently free")
            elif res.available_beds < 5:
                score -= 10
                reasons.append(f"Only {res.available_beds} beds free")
            load = res.workload_level
            if load == "LOW":
                score += 10
                reasons.append("Low current workload")
            elif load == "HIGH":
                score -= 15
                reasons.append("High current workload")
            results.append(RecommendationOut(facility=FacilityOut.model_validate(f), distance_km=distance,
                                             score=score, reasons=reasons, load=load))
        else:
            results.append(RecommendationOut(facility=FacilityOut.model_validate(f), distance_km=distance,
                                             score=score - 20, reasons=reasons + ["No resource data on file"],
                                             load="UNKNOWN"))

    results.sort(key=lambda r: r.score, reverse=True)
    return results[:5]
