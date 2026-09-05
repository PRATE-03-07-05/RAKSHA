from enum import Enum

from backend.app.db.enums import AppointmentStatus, CarePlanStatus, FollowUpStatus, ReferralStatus


class WorkflowType(str, Enum):
    REFERRAL = "referrals"
    APPOINTMENT = "appointments"
    FOLLOW_UP = "follow_ups"
    CARE_PLAN = "care_plans"


STATUS_ENUM_BY_WORKFLOW: dict[WorkflowType, type[Enum]] = {
    WorkflowType.REFERRAL: ReferralStatus,
    WorkflowType.APPOINTMENT: AppointmentStatus,
    WorkflowType.FOLLOW_UP: FollowUpStatus,
    WorkflowType.CARE_PLAN: CarePlanStatus,
}


ALLOWED_TRANSITIONS: dict[WorkflowType, dict[Enum, set[Enum]]] = {
    WorkflowType.REFERRAL: {
        ReferralStatus.CREATED: {
            ReferralStatus.ACCEPTED,
            ReferralStatus.CANCELLED,
            ReferralStatus.EXPIRED,
        },
        ReferralStatus.ACCEPTED: {
            ReferralStatus.APPOINTMENT_PENDING,
            ReferralStatus.CANCELLED,
            ReferralStatus.EXPIRED,
        },
        ReferralStatus.APPOINTMENT_PENDING: {
            ReferralStatus.APPOINTMENT_BOOKED,
            ReferralStatus.CANCELLED,
            ReferralStatus.EXPIRED,
        },
        ReferralStatus.APPOINTMENT_BOOKED: {
            ReferralStatus.PATIENT_NOTIFIED,
            ReferralStatus.CANCELLED,
            ReferralStatus.EXPIRED,
        },
        ReferralStatus.PATIENT_NOTIFIED: {
            ReferralStatus.PATIENT_ARRIVED,
            ReferralStatus.CANCELLED,
            ReferralStatus.EXPIRED,
        },
        ReferralStatus.PATIENT_ARRIVED: {
            ReferralStatus.CONSULTATION_COMPLETED,
            ReferralStatus.CANCELLED,
        },
        ReferralStatus.CONSULTATION_COMPLETED: {
            ReferralStatus.REFERRED_BACK,
            ReferralStatus.COMPLETED,
        },
        ReferralStatus.REFERRED_BACK: {
            ReferralStatus.COMPLETED,
        },
        ReferralStatus.COMPLETED: set(),
        ReferralStatus.CANCELLED: set(),
        ReferralStatus.EXPIRED: set(),
    },
    WorkflowType.APPOINTMENT: {
        AppointmentStatus.REQUESTED: {
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.CANCELLED,
        },
        AppointmentStatus.CONFIRMED: {
            AppointmentStatus.CHECKED_IN,
            AppointmentStatus.CANCELLED,
            AppointmentStatus.NO_SHOW,
        },
        AppointmentStatus.CHECKED_IN: {
            AppointmentStatus.IN_QUEUE,
            AppointmentStatus.CANCELLED,
        },
        AppointmentStatus.IN_QUEUE: {
            AppointmentStatus.IN_CONSULTATION,
            AppointmentStatus.CANCELLED,
        },
        AppointmentStatus.IN_CONSULTATION: {
            AppointmentStatus.COMPLETED,
            AppointmentStatus.CANCELLED,
        },
        AppointmentStatus.COMPLETED: set(),
        AppointmentStatus.CANCELLED: set(),
        AppointmentStatus.NO_SHOW: set(),
    },
    WorkflowType.FOLLOW_UP: {
        FollowUpStatus.PENDING: {
            FollowUpStatus.CONTACT_ATTEMPTED,
            FollowUpStatus.COMPLETED,
            FollowUpStatus.MISSED,
            FollowUpStatus.ESCALATED,
            FollowUpStatus.CANCELLED,
        },
        FollowUpStatus.CONTACT_ATTEMPTED: {
            FollowUpStatus.COMPLETED,
            FollowUpStatus.MISSED,
            FollowUpStatus.ESCALATED,
            FollowUpStatus.CANCELLED,
        },
        FollowUpStatus.MISSED: {
            FollowUpStatus.CONTACT_ATTEMPTED,
            FollowUpStatus.ESCALATED,
            FollowUpStatus.CANCELLED,
        },
        FollowUpStatus.ESCALATED: {
            FollowUpStatus.CONTACT_ATTEMPTED,
            FollowUpStatus.COMPLETED,
            FollowUpStatus.CANCELLED,
        },
        FollowUpStatus.COMPLETED: set(),
        FollowUpStatus.CANCELLED: set(),
    },
    WorkflowType.CARE_PLAN: {
        CarePlanStatus.ACTIVE: {
            CarePlanStatus.COMPLETED,
            CarePlanStatus.CANCELLED,
        },
        CarePlanStatus.COMPLETED: set(),
        CarePlanStatus.CANCELLED: set(),
    },
}

