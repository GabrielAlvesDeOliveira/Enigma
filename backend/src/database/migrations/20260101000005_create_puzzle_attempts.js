export async function up(knex) {
  await knex.schema.createTable("puzzle_attempts", (table) => {
    table.increments("id").primary();
    table.integer("room_id").unsigned().notNullable()
      .references("id").inTable("rooms").onDelete("CASCADE");
    table.string("puzzle_key", 40).notNullable();
    table.integer("user_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("RESTRICT");
    table.jsonb("answer").notNullable();
    table.boolean("is_correct").notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["room_id", "puzzle_key"]);
  });
}
export async function down(knex) {
  await knex.schema.dropTableIfExists("puzzle_attempts");
}
