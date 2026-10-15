export async function up(knex) {
  await knex.schema.createTable("rooms", (table) => {
    table.increments("id").primary();
    table.string("code", 6).notNullable().unique();
    table.integer("created_by").unsigned().notNullable()
      .references("id").inTable("users").onDelete("RESTRICT");
    table.enu("status", ["waiting", "in_progress", "finished"])
      .notNullable().defaultTo("waiting");
    table.enu("finish_reason", ["completed", "timeout", "cancelled"]).nullable();
    table.timestamp("started_at").nullable();
    table.timestamp("ends_at").nullable();
    table.timestamp("finished_at").nullable();
    table.timestamps(true, true);
    table.index(["created_by"]);
    table.index(["status"]);
  });
}
export async function down(knex) {
  await knex.schema.dropTableIfExists("rooms");
}
