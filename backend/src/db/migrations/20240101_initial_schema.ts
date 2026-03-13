import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Users
  await knex.schema.createTable('users', (table) => {
    table.string('id').primary();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('name').notNullable();
    table.enum('role', ['admin', 'user']).notNullable().defaultTo('user');
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // Template categories
  await knex.schema.createTable('template_categories', (table) => {
    table.string('id').primary();
    table.string('name').notNullable().unique();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // Templates
  await knex.schema.createTable('templates', (table) => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.string('category_id').references('id').inTable('template_categories').onDelete('SET NULL');
    table.string('current_version_id').nullable(); // FK added after template_versions
    table.boolean('archived').notNullable().defaultTo(false);
    table.integer('use_count').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // Template versions
  await knex.schema.createTable('template_versions', (table) => {
    table.string('id').primary();
    table.string('template_id').notNullable().references('id').inTable('templates').onDelete('CASCADE');
    table.integer('version_number').notNullable().defaultTo(1);
    table.string('file_path').notNullable();
    table.string('original_filename').notNullable();
    table.timestamp('uploaded_at').notNullable().defaultTo(knex.fn.now());
  });

  // Template fields (per version)
  await knex.schema.createTable('template_fields', (table) => {
    table.string('id').primary();
    table.string('template_version_id').notNullable().references('id').inTable('template_versions').onDelete('CASCADE');
    table.string('field_key').notNullable();
    table.string('label').notNullable();
    table.enum('field_type', ['text', 'email', 'phone', 'date', 'number', 'textarea']).notNullable().defaultTo('text');
    table.boolean('required').notNullable().defaultTo(true);
    table.boolean('optional').notNullable().defaultTo(false);
    table.string('default_value').nullable();
    table.string('description').nullable();
    table.string('group_name').nullable();
    table.integer('order_index').notNullable().defaultTo(0);
    table.integer('max_length').nullable();
  });

  // Contracts
  await knex.schema.createTable('contracts', (table) => {
    table.string('id').primary();
    table.string('template_version_id').notNullable().references('id').inTable('template_versions').onDelete('RESTRICT');
    table.string('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('name').notNullable();
    table.enum('status', ['draft', 'generated', 'sent', 'signed', 'archived']).notNullable().defaultTo('draft');
    table.text('notes').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // Contract field values
  await knex.schema.createTable('contract_fields', (table) => {
    table.string('id').primary();
    table.string('contract_id').notNullable().references('id').inTable('contracts').onDelete('CASCADE');
    table.string('field_key').notNullable();
    table.text('value').nullable();
  });

  // Generated contract files
  await knex.schema.createTable('contract_files', (table) => {
    table.string('id').primary();
    table.string('contract_id').notNullable().references('id').inTable('contracts').onDelete('CASCADE');
    table.enum('file_type', ['pdf', 'docx']).notNullable();
    table.string('file_path').notNullable();
    table.timestamp('generated_at').notNullable().defaultTo(knex.fn.now());
  });

  // Company settings (key-value store)
  await knex.schema.createTable('company_settings', (table) => {
    table.string('key').primary();
    table.text('value').nullable();
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('company_settings');
  await knex.schema.dropTableIfExists('contract_files');
  await knex.schema.dropTableIfExists('contract_fields');
  await knex.schema.dropTableIfExists('contracts');
  await knex.schema.dropTableIfExists('template_fields');
  await knex.schema.dropTableIfExists('template_versions');
  await knex.schema.dropTableIfExists('templates');
  await knex.schema.dropTableIfExists('template_categories');
  await knex.schema.dropTableIfExists('users');
}
