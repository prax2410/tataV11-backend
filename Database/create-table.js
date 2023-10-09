const db = require("./db");
const bcrypt = require("bcrypt");
require("dotenv").config();

// User related tables
const usersTable = `CREATE TABLE IF NOT EXISTS "users_table"(
    id SERIAL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    user_name VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role INT NOT NULL DEFAULT 0,
    enable_emails BOOLEAN NOT NULL DEFAULT false,
    disable_login BOOLEAN NOT NULL DEFAULT false,
    created_on TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;

// Remaining tables
const machinesTable = `CREATE TABLE IF NOT EXISTS "machines_table"(
    id SERIAL,
    wegid VARCHAR NOT NULL,
    state VARCHAR NOT NULL,
    district VARCHAR NOT NULL,
    area VARCHAR NOT NULL,
	sub_area VARCHAR NOT NULL,
	feeder_number INT NOT NULL,
    iot_sim_number VARCHAR,
    device_id VARCHAR,
    created_on TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;

async function createTables() {
    try {
        const tables = await db.many(
            "SELECT table_name FROM information_schema.tables"
        );

        // get all table name
        const data = await Promise.all([
            createUsersTable(),
			createMachinesTable(),
        ]);

      //Check whether user table already exists or not
		async function createUsersTable() {
			const checkUsersTable = tables.filter(
				(name) => name.table_name === "users_table"
			);

			if (!checkUsersTable[0]) {
				await db.none(usersTable);
				return "Users Table created Successfully";
			} else {
				return "Users table already exist";
			}
		};

      	// check for remaining tables
		async function createMachinesTable() {
			const checkMachinesTable = tables.filter(
				(name) => name.table_name === "machines_table"
			);

			if (!checkMachinesTable[0]) {
				await db.none(machinesTable);
				return "Machines Table created Successfully";
			} else {
				return "Machines Table already exist";
			}
		};

        return data;
    } catch (error) {
        return error.message;
    }
};

module.exports = createTables;
