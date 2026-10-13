export async function up(knex) {
    await knex.schema.createTable("room_players", (table) => {
      table.integer("room_id").unsigned().notNullable()
        .references("id").inTable("rooms").onDelete("CASCADE");
      table.integer("user_id").unsigned().notNullable()
        .references("id").inTable("users").onDelete("RESTRICT");
      table.timestamp("joined_at").notNullable().defaultTo(knex.fn.now());
      table.primary(["room_id", "user_id"]);
      table.index(["user_id"]);
    });
  }
  
  export async function down(knex) {
    await knex.schema.dropTableIfExists("room_players");
  }