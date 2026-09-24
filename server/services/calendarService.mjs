import { google } from 'googleapis';
import { format, addMinutes } from 'date-fns';

function getOAuth2Client() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground',
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

function getCalendar() {
  return google.calendar({ version: 'v3', auth: getOAuth2Client() });
}

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const TIMEZONE    = process.env.GOOGLE_CALENDAR_TIMEZONE || 'Africa/Johannesburg';

/**
 * Create a Google Calendar event for a booking.
 */
export async function createCalendarEvent(booking, serviceName) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return null;

  const calendar = getCalendar();
  const startIso = `${booking.booking_date}T${booking.booking_time}`;
  const startDt  = new Date(startIso);
  const endDt    = addMinutes(startDt, booking.duration_minutes || 60);

  const event = {
    summary:     `📋 ${booking.service_name} — ${booking.customer_name}`,
    description: [
      `Booking Ref: ${booking.confirmation_code}`,
      `Service:     ${booking.service_name}`,
      `Customer:    ${booking.customer_name}`,
      `Phone:       ${booking.customer_phone}`,
      `Email:       ${booking.customer_email || 'N/A'}`,
      booking.notes ? `Notes: ${booking.notes}` : '',
    ].filter(Boolean).join('\n'),
    start: { dateTime: startDt.toISOString(), timeZone: TIMEZONE },
    end:   { dateTime: endDt.toISOString(),   timeZone: TIMEZONE },
    attendees: booking.customer_email ? [{ email: booking.customer_email }] : [],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
    colorId: '2', // Sage green in Google Calendar
  };

  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    resource:   event,
    sendUpdates: booking.customer_email ? 'all' : 'none',
  });

  return res.data;
}

/**
 * Update an existing calendar event (e.g., after rescheduling).
 */
export async function updateCalendarEvent(eventId, booking) {
  if (!process.env.GOOGLE_REFRESH_TOKEN || !eventId) return null;

  const calendar  = getCalendar();
  const startIso  = `${booking.booking_date}T${booking.booking_time}`;
  const startDt   = new Date(startIso);
  const endDt     = addMinutes(startDt, booking.duration_minutes || 60);

  const res = await calendar.events.patch({
    calendarId: CALENDAR_ID,
    eventId,
    resource: {
      summary:     `📋 ${booking.service_name} — ${booking.customer_name}`,
      start: { dateTime: startDt.toISOString(), timeZone: TIMEZONE },
      end:   { dateTime: endDt.toISOString(),   timeZone: TIMEZONE },
    },
    sendUpdates: booking.customer_email ? 'all' : 'none',
  });

  return res.data;
}

/**
 * Delete a calendar event (e.g., after cancellation).
 */
export async function deleteCalendarEvent(eventId) {
  if (!process.env.GOOGLE_REFRESH_TOKEN || !eventId) return null;

  const calendar = getCalendar();
  await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
}

/**
 * Fetch all events for a given date range (used for admin calendar view).
 */
export async function getCalendarEvents(startDate, endDate) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return [];

  const calendar = getCalendar();
  const res = await calendar.events.list({
    calendarId:  CALENDAR_ID,
    timeMin:     new Date(startDate).toISOString(),
    timeMax:     new Date(endDate).toISOString(),
    singleEvents: true,
    orderBy:     'startTime',
    maxResults:  250,
  });

  return res.data.items || [];
}

/**
 * Check busy times — used to filter available slots against external calendar events.
 */
export async function getBusyTimes(startDate, endDate) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return [];

  const calendar = getCalendar();
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: new Date(startDate).toISOString(),
      timeMax: new Date(endDate).toISOString(),
      items:   [{ id: CALENDAR_ID }],
    },
  });

  return res.data.calendars?.[CALENDAR_ID]?.busy || [];
}
