export async function up(knex) {
    await knex.schema.createTable("users", (table) => {
      table.increments("id").primary();
      table.string("name", 80).notNullable();
      table.string("email", 255).notNullable().unique();
      table.string("password_hash", 255).notNullable();
      table.enu("role", ["player", "admin"]).notNullable().defaultTo("player");
      table.timestamps(true, true);
    });
  }
  
  export async function down(knex) {
    await knex.schema.dropTableIfExists("users");
  }