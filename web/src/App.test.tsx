import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('RAKSHA web dashboard', () => {
  it('opens on the doctor triage worklist with safety language', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'RAKSHA Operations' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Triage review queue' })).toBeInTheDocument()
    expect(screen.getAllByText(/Decision support only/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Human review is required before clinical decisions/i)).toBeInTheDocument()
    expect(screen.getAllByText('SYNTHETIC').length).toBeGreaterThan(0)
  })

  it('records human review and prepares consultation without diagnosis claims', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Record human review/i }))
    expect(screen.getByText('Human review recorded for the selected synthetic triage assessment.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Human review recorded/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Prepare consultation/i }))
    expect(screen.getByText(/Diagnosis and treatment fields remain clinician-authored/i)).toBeInTheDocument()
    expect(screen.queryByText(/AI diagnosis/i)).not.toBeInTheDocument()
  })

  it('switches to facility dashboard and advances canonical workflow statuses', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: /Facility/i }))
    expect(screen.getByRole('heading', { name: 'Facility coordination' })).toBeInTheDocument()
    expect(screen.getAllByText('Current:').length).toBeGreaterThan(0)
    expect(screen.getByText('CREATED')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Advance referral/i }))
    expect(screen.getByText('Referral moved to ACCEPTED.')).toBeInTheDocument()
    expect(screen.getAllByText('ACCEPTED').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Advance queue/i }))
    expect(screen.getByText('Appointment moved to CONFIRMED.')).toBeInTheDocument()
    expect(screen.getAllByText('CONFIRMED').length).toBeGreaterThan(0)
  })

  it('switches to admin oversight and flags sync exceptions', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: /Admin/i }))
    expect(screen.getByRole('heading', { name: 'Admin oversight' })).toBeInTheDocument()
    expect(screen.getByText(/Audit hooks exist in the backend/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Flag sync conflict/i }))
    expect(screen.getByText(/Clinical data must not be silently overwritten/i)).toBeInTheDocument()
    expect(screen.getAllByText('CONFLICT').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Flag sync failure/i }))
    expect(screen.getByText(/record needs retry or field support/i)).toBeInTheDocument()
    expect(screen.getAllByText('FAILED').length).toBeGreaterThan(0)
  })

  it('selects a different synthetic case from the worklist', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Select Imran Khan' }))
    expect(screen.getByText(/SYNTH-RAKSHA-002 \/ 67 years \/ Sitapur District Hospital/i)).toBeInTheDocument()
    expect(screen.getByText('Dr. Arvind Rao')).toBeInTheDocument()
  })
})
