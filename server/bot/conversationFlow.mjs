import { supabaseAdmin } from '../supabaseClient.mjs';
import {
  getAvailableSlots,
  getAvailableDays,
  createBooking,
  rescheduleBooking,
  cancelBooking,
  getBookingByCode,
  getBookingsByPhone,
} from '../services/bookingService.mjs';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../services/calendarService.mjs';
import {
  sendBookingConfirmation,
  sendBookingRescheduled,
  sendBookingCancellation,
} from '../services/emailService.mjs';
import * as T from './templates.mjs';
import { parse, isValid, format } from 'date-fns';

// ── Conversation state steps ──────────────────────────────────────────────────
const STEPS = {
  IDLE:              'idle',
  MAIN_MENU:         'main_menu',
  SERVICE_SELECT:    'service_select',
  DATE_SELECT:       'date_select',
  TIME_SELECT:       'time_select',
  ASK_NAME:          'ask_name',
  ASK_EMAIL:         'ask_email',
  CONFIRM_BOOKING:   'confirm_booking',
  VIEW_BOOKINGS:     'view_bookings',
  RESCHEDULE_CODE:   'reschedule_code',
  RESCHEDULE_DATE:   'reschedule_date',
  RESCHEDULE_TIME:   'reschedule_time',
  RESCHEDULE_CONFIRM:'reschedule_confirm',
  CANCEL_CODE:       'cancel_code',
  CANCEL_CONFIRM:    'cancel_confirm',
};

// ── Detect special commands usable from any step ──────────────────────────────
function detectCommand(text) {
  const t = text.trim().toUpperCase();
  if (['MENU', 'HOME', 'START', 'HI', 'HELLO', 'HEY'].includes(t)) return 'MENU';
  if (['HELP', '5', '?'].includes(t)) return 'HELP';
  if (t === 'MY BOOKINGS' || t === '2') return 'MY_BOOKINGS';
  if (t.startsWith('CANCEL '))     return 'CANCEL:' + t.split(' ').slice(1).join(' ');
  if (t.startsWith('RESCHEDULE ')) return 'RESCHEDULE:' + t.split(' ').slice(1).join(' ');
  return null;
}

// ── Parse user date input (number or DD/MM/YYYY) ─────────────────────────────
function parseUserDate(input, availableDates) {
  const n = parseInt(input, 10);
  if (!isNaN(n) && n >= 1 && n <= availableDates.length) {
    return availableDates[n - 1];
  }
  // Try DD/MM/YYYY or D/M/YYYY
  const parsed = parse(input.trim(), 'd/M/yyyy', new Date());
  if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd');
  return null;
}

// ── Core: get or create conversation ────────────────────────────────────────
async function getOrCreateConversation(botServiceId, customerPhone) {
  const { data: existing } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('*')
    .eq('bot_service_id', botServiceId)
    .eq('customer_phone', customerPhone)
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await supabaseAdmin
    .from('whatsapp_conversations')
    .insert({ bot_service_id: botServiceId, customer_phone: customerPhone })
    .select()
    .single();

  return created;
}

async function updateConversation(id, step, sessionData) {
  await supabaseAdmin
    .from('whatsapp_conversations')
    .update({ current_step: step, session_data: sessionData, last_message_at: new Date().toISOString() })
    .eq('id', id);
}

async function saveMessage(conversationId, direction, text, sid = null) {
  await supabaseAdmin
    .from('whatsapp_messages')
    .insert({ conversation_id: conversationId, direction, message_text: text, twilio_message_sid: sid });
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Process an incoming WhatsApp message.
 * Returns the text reply to send back.
 */
export async function processMessage({ botServiceId, customerPhone, messageText, messageSid }) {
  // Fetch the bot service
  const { data: service } = await supabaseAdmin
    .from('whatsapp_bot_services')
    .select('*')
    .eq('id', botServiceId)
    .eq('is_active', true)
    .single();

  if (!service) return 'This service is currently unavailable. Please try again later.';

  // Get/create conversation
  const conv = await getOrCreateConversation(botServiceId, customerPhone);
  const session = conv.session_data || {};

  // Save inbound message
  await saveMessage(conv.id, 'inbound', messageText, messageSid);

  // Detect global commands
  const cmd = detectCommand(messageText);
  let reply  = '';
  let nextStep = conv.current_step;
  let nextSession = { ...session };

  try {
    // ── Global commands (available from any step) ─────────────────────────
    if (cmd === 'MENU') {
      nextStep = STEPS.MAIN_MENU;
      nextSession = {};
      reply = T.mainMenu(service.name, service.welcome_message);

    } else if (cmd === 'HELP') {
      nextStep = conv.current_step; // stay in current step
      reply = T.helpMessage();

    } else if (cmd === 'MY_BOOKINGS') {
      nextStep = STEPS.VIEW_BOOKINGS;
      nextSession = {};
      const bookings = await getBookingsByPhone(customerPhone);
      reply = T.myBookings(bookings);

    } else if (cmd?.startsWith('CANCEL:')) {
      const code    = cmd.split(':')[1].trim();
      const booking = await getBookingByCode(code);
      if (!booking || booking.customer_phone !== customerPhone) {
        reply = T.notFoundMessage(code);
      } else {
        nextStep = STEPS.CANCEL_CONFIRM;
        nextSession = { ...session, cancelBookingId: booking.id, cancelCode: code };
        reply = T.cancelConfirm(booking);
      }

    } else if (cmd?.startsWith('RESCHEDULE:')) {
      const code    = cmd.split(':')[1].trim();
      const booking = await getBookingByCode(code);
      if (!booking || booking.customer_phone !== customerPhone) {
        reply = T.notFoundMessage(code);
      } else {
        nextStep = STEPS.RESCHEDULE_DATE;
        const dates = await getAvailableDays(botServiceId);
        nextSession = { ...session, rescheduleBookingId: booking.id, rescheduleCode: code, rescheduleDates: dates };
        reply = T.rescheduleNewDate(booking, dates);
      }

    } else {
      // ── Step-based flow ─────────────────────────────────────────────────
      switch (conv.current_step) {
        case STEPS.IDLE:
        case STEPS.MAIN_MENU: {
          const n = parseInt(messageText, 10);
          if (n === 1) {
            // Book
            const { data: { data: subServices } = {} } = await supabaseAdmin
              .from('whatsapp_bot_services')
              .select('name')
              .eq('id', botServiceId);

            // Use a simple static service list for now (admin can customise)
            const services = session.serviceList || [
              { name: service.name, description: service.description },
            ];
            nextStep = STEPS.SERVICE_SELECT;
            nextSession = { ...session, serviceList: services };
            reply = T.serviceList(services);

          } else if (n === 2) {
            const bookings = await getBookingsByPhone(customerPhone);
            nextStep = STEPS.VIEW_BOOKINGS;
            reply = T.myBookings(bookings);

          } else if (n === 3) {
            nextStep = STEPS.RESCHEDULE_CODE;
            reply = T.askRescheduleCode();

          } else if (n === 4) {
            nextStep = STEPS.CANCEL_CODE;
            reply = T.askCancelCode();

          } else {
            // Default: show menu
            nextStep = STEPS.MAIN_MENU;
            nextSession = {};
            reply = T.mainMenu(service.name, service.welcome_message);
          }
          break;
        }

        case STEPS.SERVICE_SELECT: {
          const services = session.serviceList || [{ name: service.name }];
          const n = parseInt(messageText, 10);
          if (!isNaN(n) && n >= 1 && n <= services.length) {
            const selected = services[n - 1];
            const dates    = await getAvailableDays(botServiceId);
            nextStep = STEPS.DATE_SELECT;
            nextSession = { ...session, serviceName: selected.name, availableDates: dates };
            reply = T.dateList(dates, selected.name);
          } else {
            reply = T.serviceList(services);
          }
          break;
        }

        case STEPS.DATE_SELECT: {
          const dates  = session.availableDates || [];
          let chosen   = parseUserDate(messageText, dates);

          if (!chosen && messageText.trim() === '7') {
            // Fetch more dates
            const moreDates = await getAvailableDays(botServiceId, 14);
            nextSession = { ...session, availableDates: moreDates };
            reply = T.dateList(moreDates, session.serviceName);
            break;
          }

          if (!chosen) {
            reply = T.dateList(dates, session.serviceName);
            break;
          }

          const slots = await getAvailableSlots(botServiceId, chosen);
          nextStep = STEPS.TIME_SELECT;
          nextSession = { ...session, date: chosen, availableSlots: slots };
          reply = T.timeList(slots, chosen);
          break;
        }

        case STEPS.TIME_SELECT: {
          const slots = session.availableSlots || [];
          const n     = parseInt(messageText, 10);
          if (isNaN(n) || n < 1 || n > slots.length) {
            reply = T.timeList(slots, session.date);
            break;
          }
          nextStep = STEPS.ASK_NAME;
          nextSession = { ...session, time: slots[n - 1] };
          reply = T.askName();
          break;
        }

        case STEPS.ASK_NAME: {
          const name = messageText.trim();
          if (name.length < 2) { reply = T.askName(); break; }
          nextStep = STEPS.ASK_EMAIL;
          nextSession = { ...session, name };
          reply = T.askEmail();
          break;
        }

        case STEPS.ASK_EMAIL: {
          const raw   = messageText.trim().toLowerCase();
          const email = raw === 'skip' ? null : raw;
          nextStep = STEPS.CONFIRM_BOOKING;
          nextSession = { ...session, email };
          reply = T.bookingConfirmPrompt({ ...session, email });
          break;
        }

        case STEPS.CONFIRM_BOOKING: {
          const answer = messageText.trim().toUpperCase();
          if (['YES', 'Y', 'CONFIRM', '1'].includes(answer)) {
            const booking = await createBooking({
              botServiceId,
              conversationId:   conv.id,
              customerName:     session.name,
              customerPhone,
              customerEmail:    session.email,
              serviceName:      session.serviceName || service.name,
              bookingDate:      session.date,
              bookingTime:      session.time,
              durationMinutes:  service.booking_duration_minutes || 60,
            });

            // Side effects (non-blocking)
            Promise.allSettled([
              session.email ? sendBookingConfirmation(booking, service.name) : Promise.resolve(),
              createCalendarEvent(booking, service.name).then((evt) => {
                if (evt?.id) {
                  return supabaseAdmin
                    .from('whatsapp_bookings')
                    .update({ google_event_id: evt.id, email_sent: !!session.email })
                    .eq('id', booking.id);
                }
              }),
            ]);

            nextStep = STEPS.IDLE;
            nextSession = {};
            reply = T.bookingConfirmed(booking);

          } else {
            nextStep = STEPS.MAIN_MENU;
            nextSession = {};
            reply = T.mainMenu(service.name, service.welcome_message);
          }
          break;
        }

        case STEPS.VIEW_BOOKINGS:
        default: {
          nextStep = STEPS.MAIN_MENU;
          nextSession = {};
          reply = T.mainMenu(service.name, service.welcome_message);
          break;
        }

        case STEPS.RESCHEDULE_CODE: {
          const booking = await getBookingByCode(messageText.trim());
          if (!booking || booking.customer_phone !== customerPhone) {
            reply = T.notFoundMessage(messageText.trim());
            break;
          }
          const dates = await getAvailableDays(botServiceId);
          nextStep = STEPS.RESCHEDULE_DATE;
          nextSession = { ...session, rescheduleBookingId: booking.id, rescheduleCode: booking.confirmation_code, rescheduleDates: dates, rescheduleBooking: booking };
          reply = T.rescheduleNewDate(booking, dates);
          break;
        }

        case STEPS.RESCHEDULE_DATE: {
          const dates  = session.rescheduleDates || [];
          const chosen = parseUserDate(messageText, dates);
          if (!chosen) { reply = T.rescheduleNewDate(session.rescheduleBooking, dates); break; }
          const slots  = await getAvailableSlots(botServiceId, chosen);
          nextStep = STEPS.RESCHEDULE_TIME;
          nextSession = { ...session, rescheduleNewDate: chosen, rescheduleSlots: slots };
          reply = T.rescheduleNewTime(slots, chosen);
          break;
        }

        case STEPS.RESCHEDULE_TIME: {
          const slots = session.rescheduleSlots || [];
          const n     = parseInt(messageText, 10);
          if (isNaN(n) || n < 1 || n > slots.length) { reply = T.rescheduleNewTime(slots, session.rescheduleNewDate); break; }
          nextStep = STEPS.RESCHEDULE_CONFIRM;
          nextSession = { ...session, rescheduleNewTime: slots[n - 1] };
          reply = T.rescheduleConfirmPrompt(session.rescheduleBooking, session.rescheduleNewDate, slots[n - 1]);
          break;
        }

        case STEPS.RESCHEDULE_CONFIRM: {
          const answer = messageText.trim().toUpperCase();
          if (['YES', 'Y', '1'].includes(answer)) {
            const { booking, previous } = await rescheduleBooking(
              session.rescheduleBookingId,
              session.rescheduleNewDate,
              session.rescheduleNewTime,
            );

            Promise.allSettled([
              booking.customer_email
                ? sendBookingRescheduled(booking, previous.date, previous.time, service.name)
                : Promise.resolve(),
              booking.google_event_id
                ? updateCalendarEvent(booking.google_event_id, booking)
                : Promise.resolve(),
            ]);

            nextStep = STEPS.IDLE;
            nextSession = {};
            reply = T.rescheduleDone(booking);
          } else {
            nextStep = STEPS.MAIN_MENU;
            nextSession = {};
            reply = T.mainMenu(service.name, service.welcome_message);
          }
          break;
        }

        case STEPS.CANCEL_CODE: {
          const booking = await getBookingByCode(messageText.trim());
          if (!booking || booking.customer_phone !== customerPhone) {
            reply = T.notFoundMessage(messageText.trim());
            break;
          }
          nextStep = STEPS.CANCEL_CONFIRM;
          nextSession = { ...session, cancelBookingId: booking.id, cancelCode: booking.confirmation_code, cancelBooking: booking };
          reply = T.cancelConfirm(booking);
          break;
        }

        case STEPS.CANCEL_CONFIRM: {
          const answer = messageText.trim().toUpperCase();
          if (['YES', 'Y', '1'].includes(answer)) {
            const cancelled = await cancelBooking(session.cancelBookingId);

            Promise.allSettled([
              cancelled.customer_email
                ? sendBookingCancellation(cancelled, service.name)
                : Promise.resolve(),
              cancelled.google_event_id
                ? deleteCalendarEvent(cancelled.google_event_id)
                : Promise.resolve(),
            ]);

            nextStep = STEPS.IDLE;
            nextSession = {};
            reply = T.bookingCancelled(session.cancelCode);
          } else {
            nextStep = STEPS.MAIN_MENU;
            nextSession = {};
            reply = T.mainMenu(service.name, service.welcome_message);
          }
          break;
        }
      }
    }
  } catch (err) {
    console.error('[Bot] Error processing message:', err);
    reply = T.errorMessage();
    nextStep = STEPS.IDLE;
    nextSession = {};
  }

  // Persist conversation state
  await updateConversation(conv.id, nextStep, nextSession);

  // Save outbound message
  if (reply) await saveMessage(conv.id, 'outbound', reply);

  return reply;
}
