const { supabase } = require('../supabaseClient');

const getAuthorizedAppointment = async ({ appointmentId, userId, role }) => {
  if (!appointmentId) {
    return {
      appointment: null,
      status: 400,
      error: 'Appointment ID is required',
    };
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('id, appointment_number, title, client_id, provider_id')
    .eq('id', appointmentId)
    .single();

  if (error || !data) {
    return {
      appointment: null,
      status: 404,
      error: 'Appointment not found',
    };
  }

  if (role !== 'admin' && data.client_id !== userId && data.provider_id !== userId) {
    return {
      appointment: null,
      status: 403,
      error: 'You are not authorized to access this conversation',
    };
  }

  return {
    appointment: data,
    status: 200,
    error: null,
  };
};

module.exports = {
  getAuthorizedAppointment,
};
