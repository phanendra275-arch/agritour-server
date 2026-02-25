const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database', 'agrotourism.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to database for seeding...');
});

// Sample farms data
const sampleFarms = [
  {
    name: "Green Valley Organic Farm",
    description: "Experience organic farming at its best. Learn about sustainable agriculture, fresh vegetables, and eco-friendly farming practices. Perfect for families and school groups.",
    location: "Mysore, Karnataka",
    price_per_visitor: 500,
    daily_capacity: 20,
    seasonal_availability_start: "2024-01-01",
    seasonal_availability_end: "2024-12-31",
    image_url: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800"
  },
  {
    name: "Fresh Milk Dairy Farm",
    description: "Visit our modern dairy farm and learn about milk production. See cows, learn milking process, and enjoy fresh dairy products. Great educational experience!",
    location: "Bangalore, Karnataka",
    price_per_visitor: 300,
    daily_capacity: 15,
    seasonal_availability_start: "2024-01-01",
    seasonal_availability_end: "2024-12-31",
    image_url: "https://images.unsplash.com/photo-1560493676-04071c5f467b?w=800"
  },
  {
    name: "Sweet Mango Orchard",
    description: "Seasonal fruit picking experience! Visit during mango season (April-June) to pick fresh mangoes. Learn about fruit cultivation and enjoy farm-fresh produce.",
    location: "Mysore, Karnataka",
    price_per_visitor: 400,
    daily_capacity: 25,
    seasonal_availability_start: "2024-04-01",
    seasonal_availability_end: "2024-06-30",
    image_url: "https://images.unsplash.com/photo-1605027990122-3e0b8c8b0a0a?w=800"
  },
  {
    name: "Heritage Spice Plantation",
    description: "Explore our spice plantation with guided tours. Learn about cardamom, pepper, vanilla cultivation. Traditional farming methods and spice processing demonstration.",
    location: "Coorg, Karnataka",
    price_per_visitor: 600,
    daily_capacity: 18,
    seasonal_availability_start: "2024-03-01",
    seasonal_availability_end: "2024-11-30",
    image_url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800"
  },
  {
    name: "Rice Paddy Experience",
    description: "Experience traditional rice cultivation. Learn about paddy farming, water management, and rice processing. Seasonal activities include planting and harvesting.",
    location: "Mandya, Karnataka",
    price_per_visitor: 350,
    daily_capacity: 30,
    seasonal_availability_start: "2024-06-01",
    seasonal_availability_end: "2024-12-31",
    image_url: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800"
  }
];

async function seedData() {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Check if sample farmer exists
        db.get('SELECT id FROM users WHERE username = ?', ['sample_farmer'], async (err, user) => {
          if (err) {
            console.error('Error checking user:', err);
            return reject(err);
          }

          let farmerId;

          if (!user) {
            // Create sample farmer
            const hashedPassword = await bcrypt.hash('farmer123', 10);
            db.run(
              `INSERT INTO users (username, email, password, role, full_name, phone)
               VALUES (?, ?, ?, ?, ?, ?)`,
              ['sample_farmer', 'farmer@agrotourism.com', hashedPassword, 'farmer', 'Sample Farmer', '9876543210'],
              function(err) {
                if (err) {
                  console.error('Error creating farmer:', err);
                  return reject(err);
                }
                farmerId = this.lastID;
                console.log('✅ Sample farmer created (username: sample_farmer, password: farmer123)');
                insertFarms(farmerId, resolve, reject);
              }
            );
          } else {
            farmerId = user.id;
            console.log('✅ Sample farmer already exists');
            insertFarms(farmerId, resolve, reject);
          }
        });
      } catch (error) {
        console.error('Error in seedData:', error);
        reject(error);
      }
    });
  });
}

function insertFarms(farmerId, resolve, reject) {
  let farmsInserted = 0;
  let farmsSkipped = 0;

  sampleFarms.forEach((farm, index) => {
    // Check if farm already exists
    db.get('SELECT id FROM farms WHERE name = ? AND farmer_id = ?', [farm.name, farmerId], (err, existing) => {
      if (err) {
        console.error(`Error checking farm ${farm.name}:`, err);
        return;
      }

      if (existing) {
        farmsSkipped++;
        console.log(`⏭️  Farm "${farm.name}" already exists, skipping...`);
      } else {
        db.run(
          `INSERT INTO farms (farmer_id, name, description, location, price_per_visitor, daily_capacity, 
           seasonal_availability_start, seasonal_availability_end, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            farmerId,
            farm.name,
            farm.description,
            farm.location,
            farm.price_per_visitor,
            farm.daily_capacity,
            farm.seasonal_availability_start,
            farm.seasonal_availability_end,
            farm.image_url
          ],
          function(err) {
            if (err) {
              console.error(`Error inserting farm ${farm.name}:`, err);
            } else {
              farmsInserted++;
              console.log(`✅ Farm "${farm.name}" created (ID: ${this.lastID})`);
            }

            // Check if all farms processed
            if (farmsInserted + farmsSkipped === sampleFarms.length) {
              console.log('\n📊 Summary:');
              console.log(`   - Farms created: ${farmsInserted}`);
              console.log(`   - Farms skipped (already exist): ${farmsSkipped}`);
              console.log('\n🎉 Seeding completed!');
              console.log('\n📝 Login Credentials:');
              console.log('   Username: sample_farmer');
              console.log('   Password: farmer123');
              console.log('\n🌐 Now you can:');
              console.log('   1. Browse farms at http://localhost:3000/farms');
              console.log('   2. Login as sample_farmer to manage farms');
              console.log('   3. Register as tourist to make bookings\n');
              db.close();
              resolve();
            }
          }
        );
      }
    });
  });
}

// Run seeding
seedData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    db.close();
    process.exit(1);
  });

