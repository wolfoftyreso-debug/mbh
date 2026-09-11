import "dotenv/config";
process.env.DATABASE_URL ??= "postgres://humanauth@127.0.0.1:5433/humanauth";
