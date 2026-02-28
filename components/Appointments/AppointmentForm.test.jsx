import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AppointmentForm from '@/components/Appointments/AppointmentForm';

describe('AppointmentForm', () => {
  it('shows validation error when title is missing', async () => {
    render(
      <AppointmentForm
        initialValues={{ title: '', notes: '', appointmentDate: '', status: 'pending' }}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
        isSaving={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save appointment/i }));

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });
  });
});
