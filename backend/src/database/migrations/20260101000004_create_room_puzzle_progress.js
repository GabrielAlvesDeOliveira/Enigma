export async function up(knex) {
  await knex.schema.createTable("room_puzzle_progress", (table) => {
    table.integer("room_id").unsigned().notNullable()
      .references("id").inTable("rooms").onDelete("CASCADE");
    table.string("puzzle_key", 40).notNullable();
    table.enu("status", ["open", "solved"]).notNullable().defaultTo("open");
    table.integer("solved_by").unsigned().nullable()
      .references("id").inTable("users").onDelete("RESTRICT");
    table.timestamp("solved_at").nullable();
    table.primary(["room_id", "puzzle_key"]);
  });
}
export async function down(knex) {
  await knex.schema.dropTableIfExists("room_puzzle_progress");
}
