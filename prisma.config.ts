import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // Sử dụng path.join để Windows nhận diện chính xác đường dẫn tuyệt đối
  schema: path.join("src", "prisma", "schema.prisma"), 
  
  datasource: {
    url: env("DATABASE_URL"), 
  },
  
  migrations: {
    path: path.join("src", "prisma", "migrations"),
  },
});
