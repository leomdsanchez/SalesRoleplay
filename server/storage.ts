import { type User, type InsertUser, users } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db/sqlite";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class SqliteStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const rows = db.select().from(users).where(eq(users.id, id)).limit(1).all();
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = db.select().from(users).where(eq(users.username, username)).limit(1).all();
    return rows[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const newUser: User = { 
      id, 
      username: insertUser.username,
      password: hashedPassword 
    };
    db.insert(users).values(newUser).run();
    return newUser;
  }
}

export const storage = new SqliteStorage();
