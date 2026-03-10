// MongoDB seed: creates the civilizatu database, user, and inserts the default scenario.
// Runs automatically on first start via docker-entrypoint-initdb.d

db = db.getSiblingDB("civilizatu");

// Create app user with limited privileges
db.createUser({
  user: "civilizatu_app",
  pwd: "civilizatu_pass",
  roles: [{ role: "readWrite", db: "civilizatu" }],
});

// Create indexes
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.games.createIndex({ user_id: 1, last_saved: -1 });

// Insert default scenario (the game logic builds the full map at runtime)
db.scenarios.insertOne({
  name: "Classic Map",
  description: "A balanced 50×50 hex map with varied terrain, resources, and starting positions for a classic Civilization experience.",
  difficulty: "normal",
  map_width: 50,
  map_height: 50,
  seed: 42,
  initial_state: {},
});

print("Seed complete: civilizatu database initialized.");
