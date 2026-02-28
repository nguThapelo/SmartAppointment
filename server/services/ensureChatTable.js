const { Pool } = require('pg');
const { supabase } = require('../supabaseClient');

let ensurePromise = null;
let initialized = false;

const chatMessageSelect =
  'id, appointment_id, sender_id, sender_role, sender_name, message_text, created_at, edited_at, deleted_at';

const createPool = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });
};

const pool = createPool();

const isMissingChatTableError = (error) =>
  Boolean(error?.message && error.message.includes('appointment_chat_messages'));

const mapMessageRow = (row) => ({
  ...row,
  attachments: row?.attachments || [],
});

const ensureAppointmentChatTable = async () => {
  if (initialized || !pool) {
    return;
  }

  if (!ensurePromise) {
    ensurePromise = (async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS public.appointment_chat_messages (
            id uuid primary key default gen_random_uuid(),
            appointment_id uuid not null references public.appointments(id) on delete cascade,
            sender_id uuid not null,
            sender_role text not null,
            sender_name text,
            message_text text not null,
            edited_at timestamptz,
            deleted_at timestamptz,
            deleted_by uuid,
            created_at timestamptz not null default now()
          );
        `);

        await client.query(`
          ALTER TABLE public.appointment_chat_messages
          ADD COLUMN IF NOT EXISTS edited_at timestamptz;
        `);

        await client.query(`
          ALTER TABLE public.appointment_chat_messages
          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
        `);

        await client.query(`
          ALTER TABLE public.appointment_chat_messages
          ADD COLUMN IF NOT EXISTS deleted_by uuid;
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS public.appointment_chat_files (
            id uuid primary key default gen_random_uuid(),
            message_id uuid not null references public.appointment_chat_messages(id) on delete cascade,
            appointment_id uuid not null references public.appointments(id) on delete cascade,
            file_name text not null,
            file_url text not null,
            file_size bigint,
            mime_type text,
            uploaded_by uuid not null,
            created_at timestamptz not null default now()
          );
        `);

        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_appointment_chat_messages_appointment_id_created_at
          ON public.appointment_chat_messages (appointment_id, created_at);
        `);

        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_appointment_chat_files_message_id
          ON public.appointment_chat_files (message_id);
        `);

        await client.query(`
          SELECT pg_notify('pgrst', 'reload schema');
        `);

        initialized = true;
      } finally {
        client.release();
      }
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  await ensurePromise;
};

const canEnsureAppointmentChatTable = () => Boolean(pool);

const getChatTableEnsureStatus = () => ({
  canEnsure: Boolean(pool),
  initialized,
});

const loadMessagesWithAttachmentsPg = async (client, appointmentId) => {
  const result = await client.query(
    `
      SELECT
        m.id,
        m.appointment_id,
        m.sender_id,
        m.sender_role,
        m.sender_name,
        m.message_text,
        m.edited_at,
        m.deleted_at,
        m.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', f.id,
              'message_id', f.message_id,
              'appointment_id', f.appointment_id,
              'file_name', f.file_name,
              'file_url', f.file_url,
              'file_size', f.file_size,
              'mime_type', f.mime_type,
              'uploaded_by', f.uploaded_by,
              'created_at', f.created_at
            )
          ) FILTER (WHERE f.id IS NOT NULL),
          '[]'::json
        ) AS attachments
      FROM public.appointment_chat_messages m
      LEFT JOIN public.appointment_chat_files f ON f.message_id = m.id
      WHERE m.appointment_id = $1
      GROUP BY m.id
      ORDER BY m.created_at ASC
      LIMIT 200
    `,
    [appointmentId]
  );

  return (result.rows || []).map(mapMessageRow);
};

const listAppointmentChatMessages = async (appointmentId) => {
  if (pool) {
    const client = await pool.connect();
    try {
      const rows = await loadMessagesWithAttachmentsPg(client, appointmentId);
      return { data: rows, error: null };
    } catch (sqlError) {
      return { data: null, error: sqlError };
    } finally {
      client.release();
    }
  }

  const { data, error } = await supabase
    .schema('public')
    .from('appointment_chat_messages')
    .select(chatMessageSelect)
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (!error) {
    return { data: (data || []).map(mapMessageRow), error: null };
  }

  return { data: null, error };
};

const getAppointmentChatMessageById = async (messageId) => {
  if (!pool) {
    const { data, error } = await supabase
      .schema('public')
      .from('appointment_chat_messages')
      .select(chatMessageSelect)
      .eq('id', messageId)
      .single();

    return { data: data ? mapMessageRow(data) : null, error };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        SELECT
          m.id,
          m.appointment_id,
          m.sender_id,
          m.sender_role,
          m.sender_name,
          m.message_text,
          m.edited_at,
          m.deleted_at,
          m.created_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', f.id,
                'message_id', f.message_id,
                'appointment_id', f.appointment_id,
                'file_name', f.file_name,
                'file_url', f.file_url,
                'file_size', f.file_size,
                'mime_type', f.mime_type,
                'uploaded_by', f.uploaded_by,
                'created_at', f.created_at
              )
            ) FILTER (WHERE f.id IS NOT NULL),
            '[]'::json
          ) AS attachments
        FROM public.appointment_chat_messages m
        LEFT JOIN public.appointment_chat_files f ON f.message_id = m.id
        WHERE m.id = $1
        GROUP BY m.id
      `,
      [messageId]
    );

    return { data: result.rows?.[0] ? mapMessageRow(result.rows[0]) : null, error: null };
  } catch (sqlError) {
    return { data: null, error: sqlError };
  } finally {
    client.release();
  }
};

const insertAppointmentChatMessage = async (payload) => {
  if (pool) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
          INSERT INTO public.appointment_chat_messages
            (appointment_id, sender_id, sender_role, sender_name, message_text)
          VALUES
            ($1, $2, $3, $4, $5)
          RETURNING id, appointment_id, sender_id, sender_role, sender_name, message_text, edited_at, deleted_at, created_at
        `,
        [
          payload.appointment_id,
          payload.sender_id,
          payload.sender_role,
          payload.sender_name || null,
          payload.message_text,
        ]
      );

      return { data: mapMessageRow(result.rows?.[0] || null), error: null };
    } catch (sqlError) {
      return { data: null, error: sqlError };
    } finally {
      client.release();
    }
  }

  const { data, error } = await supabase
    .schema('public')
    .from('appointment_chat_messages')
    .insert(payload)
    .select(chatMessageSelect)
    .single();

  if (!error) {
    return { data: mapMessageRow(data), error: null };
  }

  return { data: null, error };
};

const updateAppointmentChatMessage = async ({ messageId, messageText }) => {
  if (!pool) {
    const { data, error } = await supabase
      .schema('public')
      .from('appointment_chat_messages')
      .update({ message_text: messageText, edited_at: new Date().toISOString() })
      .eq('id', messageId)
      .is('deleted_at', null)
      .select(chatMessageSelect)
      .single();

    return { data: data ? mapMessageRow(data) : null, error };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        UPDATE public.appointment_chat_messages
        SET message_text = $2, edited_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, appointment_id, sender_id, sender_role, sender_name, message_text, edited_at, deleted_at, created_at
      `,
      [messageId, messageText]
    );

    return { data: result.rows?.[0] ? mapMessageRow(result.rows[0]) : null, error: null };
  } catch (sqlError) {
    return { data: null, error: sqlError };
  } finally {
    client.release();
  }
};

const softDeleteAppointmentChatMessage = async ({ messageId, deletedBy }) => {
  if (!pool) {
    const { data, error } = await supabase
      .schema('public')
      .from('appointment_chat_messages')
      .update({
        message_text: '[deleted]',
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
      })
      .eq('id', messageId)
      .is('deleted_at', null)
      .select(chatMessageSelect)
      .single();

    return { data: data ? mapMessageRow(data) : null, error };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        UPDATE public.appointment_chat_messages
        SET message_text = '[deleted]', deleted_at = now(), deleted_by = $2
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, appointment_id, sender_id, sender_role, sender_name, message_text, edited_at, deleted_at, created_at
      `,
      [messageId, deletedBy]
    );

    return { data: result.rows?.[0] ? mapMessageRow(result.rows[0]) : null, error: null };
  } catch (sqlError) {
    return { data: null, error: sqlError };
  } finally {
    client.release();
  }
};

const createChatFileAttachments = async ({ messageId, appointmentId, userId, files }) => {
  if (!files?.length) {
    return { data: [], error: null };
  }

  if (!pool) {
    return { data: [], error: new Error('File attachments require DATABASE_URL configuration') };
  }

  const client = await pool.connect();
  try {
    const attachments = [];
    for (const file of files) {
      const result = await client.query(
        `
          INSERT INTO public.appointment_chat_files
            (message_id, appointment_id, file_name, file_url, file_size, mime_type, uploaded_by)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, message_id, appointment_id, file_name, file_url, file_size, mime_type, uploaded_by, created_at
        `,
        [
          messageId,
          appointmentId,
          file.fileName,
          file.fileUrl,
          file.fileSize || 0,
          file.mimeType || null,
          userId,
        ]
      );
      attachments.push(result.rows[0]);
    }

    return { data: attachments, error: null };
  } catch (sqlError) {
    return { data: null, error: sqlError };
  } finally {
    client.release();
  }
};

const getChatAttachmentById = async (fileId) => {
  if (!pool) {
    return { data: null, error: new Error('File attachments require DATABASE_URL configuration') };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        SELECT
          f.id,
          f.message_id,
          f.appointment_id,
          f.file_name,
          f.file_url,
          f.file_size,
          f.mime_type,
          f.uploaded_by,
          f.created_at,
          m.sender_id
        FROM public.appointment_chat_files f
        INNER JOIN public.appointment_chat_messages m ON m.id = f.message_id
        WHERE f.id = $1
      `,
      [fileId]
    );

    return { data: result.rows?.[0] || null, error: null };
  } catch (sqlError) {
    return { data: null, error: sqlError };
  } finally {
    client.release();
  }
};

const deleteChatAttachmentById = async (fileId) => {
  if (!pool) {
    return { data: null, error: new Error('File attachments require DATABASE_URL configuration') };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        DELETE FROM public.appointment_chat_files
        WHERE id = $1
        RETURNING id, message_id, appointment_id, file_name, file_url
      `,
      [fileId]
    );

    return { data: result.rows?.[0] || null, error: null };
  } catch (sqlError) {
    return { data: null, error: sqlError };
  } finally {
    client.release();
  }
};

module.exports = {
  ensureAppointmentChatTable,
  isMissingChatTableError,
  canEnsureAppointmentChatTable,
  getChatTableEnsureStatus,
  listAppointmentChatMessages,
  insertAppointmentChatMessage,
  getAppointmentChatMessageById,
  updateAppointmentChatMessage,
  softDeleteAppointmentChatMessage,
  createChatFileAttachments,
  getChatAttachmentById,
  deleteChatAttachmentById,
};
