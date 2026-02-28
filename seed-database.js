require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function seedDatabase() {
  try {
    console.log('Seeding database with initial data...');

    // Seed service categories
    console.log('Seeding service categories...');
    const serviceCategories = [
      { name: 'Consultation', description: 'General consultation services' },
      { name: 'Therapy', description: 'Therapeutic services' },
      { name: 'Coaching', description: 'Life coaching and mentoring' },
      { name: 'Training', description: 'Professional training sessions' },
      { name: 'Assessment', description: 'Assessment and evaluation services' },
    ];

    for (const category of serviceCategories) {
      const { error } = await supabase
        .from('service_categories')
        .upsert(category, { onConflict: 'name' });

      if (error) {
        console.error(`Error seeding service category ${category.name}:`, error);
      }
    }

    // Seed master data types
    console.log('Seeding master data types...');
    const masterDataTypes = [
      { name: 'appointment_status', description: 'Possible appointment statuses' },
      { name: 'user_roles', description: 'User role definitions' },
      { name: 'payment_status', description: 'Payment transaction statuses' },
    ];

    for (const type of masterDataTypes) {
      const { error } = await supabase
        .from('master_data_types')
        .upsert(type, { onConflict: 'name' });

      if (error) {
        console.error(`Error seeding master data type ${type.name}:`, error);
      }
    }

    // Get the master data type IDs
    const { data: types } = await supabase
      .from('master_data_types')
      .select('id, name');

    const typeMap = {};
    types.forEach(type => {
      typeMap[type.name] = type.id;
    });

    // Seed master data items
    console.log('Seeding master data items...');
    const masterDataItems = [
      // Appointment statuses
      { type_id: typeMap.appointment_status, key: 'pending', value: 'Pending', description: 'Appointment is scheduled but not yet confirmed' },
      { type_id: typeMap.appointment_status, key: 'confirmed', value: 'Confirmed', description: 'Appointment is confirmed and will proceed' },
      { type_id: typeMap.appointment_status, key: 'in_progress', value: 'In Progress', description: 'Appointment is currently happening' },
      { type_id: typeMap.appointment_status, key: 'completed', value: 'Completed', description: 'Appointment has been completed successfully' },
      { type_id: typeMap.appointment_status, key: 'cancelled', value: 'Cancelled', description: 'Appointment has been cancelled' },
      { type_id: typeMap.appointment_status, key: 'no_show', value: 'No Show', description: 'Client did not show up for appointment' },

      // User roles
      { type_id: typeMap.user_roles, key: 'admin', value: 'Administrator', description: 'Full system access' },
      { type_id: typeMap.user_roles, key: 'provider', value: 'Service Provider', description: 'Can provide services and manage appointments' },
      { type_id: typeMap.user_roles, key: 'client', value: 'Client', description: 'Can book appointments and view their data' },

      // Payment statuses
      { type_id: typeMap.payment_status, key: 'pending', value: 'Pending', description: 'Payment is being processed' },
      { type_id: typeMap.payment_status, key: 'succeeded', value: 'Succeeded', description: 'Payment was successful' },
      { type_id: typeMap.payment_status, key: 'failed', value: 'Failed', description: 'Payment failed' },
      { type_id: typeMap.payment_status, key: 'cancelled', value: 'Cancelled', description: 'Payment was cancelled' },
      { type_id: typeMap.payment_status, key: 'refunded', value: 'Refunded', description: 'Payment was refunded' },
    ];

    for (const item of masterDataItems) {
      const { error } = await supabase
        .from('master_data_items')
        .upsert(item, { onConflict: 'type_id,key' });

      if (error) {
        console.error(`Error seeding master data item ${item.key}:`, error);
      }
    }

    // Seed a default feedback question set
    console.log('Seeding feedback question set...');
    const { data: questionSet, error: questionSetError } = await supabase
      .from('feedback_question_sets')
      .upsert({
        name: 'Post-Appointment Feedback',
        description: 'Standard feedback questions after appointment completion',
        is_active: true,
      }, { onConflict: 'name' })
      .select()
      .single();

    if (questionSetError) {
      console.error('Error creating feedback question set:', questionSetError);
    } else {
      // Seed feedback questions
      const feedbackQuestions = [
        {
          question_set_id: questionSet.id,
          question_text: 'How would you rate the overall quality of the service?',
          question_type: 'rating',
          options: { min: 1, max: 5, labels: { 1: 'Poor', 5: 'Excellent' } },
          is_required: true,
          sort_order: 1,
        },
        {
          question_set_id: questionSet.id,
          question_text: 'Did the service meet your expectations?',
          question_type: 'yes_no',
          is_required: true,
          sort_order: 2,
        },
        {
          question_set_id: questionSet.id,
          question_text: 'What did you like most about the service?',
          question_type: 'text',
          is_required: false,
          sort_order: 3,
        },
        {
          question_set_id: questionSet.id,
          question_text: 'What could be improved?',
          question_type: 'text',
          is_required: false,
          sort_order: 4,
        },
        {
          question_set_id: questionSet.id,
          question_text: 'Would you recommend this service to others?',
          question_type: 'yes_no',
          is_required: true,
          sort_order: 5,
        },
      ];

      for (const question of feedbackQuestions) {
        const { error } = await supabase
          .from('feedback_questions')
          .upsert(question, { onConflict: 'question_set_id,sort_order' });

        if (error) {
          console.error('Error seeding feedback question:', error);
        }
      }
    }

    console.log('Database seeding completed successfully!');
    console.log('Initial data has been populated.');

  } catch (error) {
    console.error('Database seeding failed:', error);
    throw error;
  }
}

seedDatabase().catch(console.error);