import { eq } from "drizzle-orm";
import {users} from "@/apis/ConfigApi/db/Schema.ts";
import {getDb} from "@/apis/ConfigApi/db/Client.ts";

export async function addUser(name: string, email: string) {
    const db = await getDb();
    await db.insert(users).values({ name, email });
}

export async function getUsers() {
    const db = await getDb();
    return db.select().from(users);
}

export async function getUserByEmail(email: string) {
    const db = await getDb();
    return db.select().from(users).where(eq(users.email, email));
}
