-- TechGear seed data (products come from js/products.js)
PRAGMA foreign_keys = ON;
BEGIN;

-- categories
INSERT INTO categories (name) VALUES ('Audio');
INSERT INTO categories (name) VALUES ('Bags');
INSERT INTO categories (name) VALUES ('Input devices');
INSERT INTO categories (name) VALUES ('Networking');
INSERT INTO categories (name) VALUES ('Power & cables');
INSERT INTO categories (name) VALUES ('Storage');

-- products (24)
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('keyboard','USB Keyboard','Full-size wired keyboard with numeric keypad and quiet keys. Plug and play on Windows, Linux and macOS.',45000,25,'keyboard.jpg',(SELECT category_id FROM categories WHERE name='Input devices'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('mouse','Wireless Mouse','2.4GHz wireless optical mouse with USB receiver. Needs 1 AA battery (included).',25000,40,'mouse.jpg',(SELECT category_id FROM categories WHERE name='Input devices'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('combo','Wireless Keyboard & Mouse Combo','Spill-resistant keyboard and mouse sharing one USB receiver. Ideal for office and home use.',75000,12,'wireless keyboard & mouse combo.jpg',(SELECT category_id FROM categories WHERE name='Input devices'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('gamingmouse','Gaming Mouse 3200 DPI','Wired mouse with 6 buttons, adjustable DPI and LED lighting.',40000,0,'gaming mouse.jpg',(SELECT category_id FROM categories WHERE name='Input devices'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('mousepad','Mouse Pad (Large)','Non-slip rubber base, smooth cloth surface, 30 x 25 cm.',8000,60,'mouse pad.jpg',(SELECT category_id FROM categories WHERE name='Input devices'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('headphones','Stereo Headphones','Over-ear headphones with padded cushions and 3.5mm jack. Good for lectures and music.',55000,18,'headphones.jpg',(SELECT category_id FROM categories WHERE name='Audio'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('earphones','Wired Earphones with Mic','In-ear earphones with inline microphone and 3 sizes of ear tips.',15000,50,'wired Earphones with mic.jpg',(SELECT category_id FROM categories WHERE name='Audio'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('usbheadset','USB Headset with Microphone','Noise-reducing microphone for online classes and video calls. USB plug, no driver needed.',60000,9,'USB Headset with microphone.jpg',(SELECT category_id FROM categories WHERE name='Audio'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('speaker','Bluetooth Speaker','Portable speaker with 8 hours of playback, USB-C charging and microphone.',85000,7,'placeholder.svg',(SELECT category_id FROM categories WHERE name='Audio'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('flashdisk','Flash Disk 32GB','USB 3.0 flash drive with fast transfers. Fits in a pocket.',28000,80,'flashdisk.jpg',(SELECT category_id FROM categories WHERE name='Storage'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('flashdisk64','Flash Disk 64GB','USB 3.0 flash drive, 64GB. Good for backups and large project files.',40000,45,'flashdisk.jpg',(SELECT category_id FROM categories WHERE name='Storage'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('hdd500','Portable Hard Drive 500GB','USB 3.0 external drive, 500GB, with protective case and cable.',190000,6,'placeholder.svg',(SELECT category_id FROM categories WHERE name='Storage'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('microsd','MicroSD Card 128GB','Class 10 memory card for phones, cameras and tablets, with SD adapter.',45000,22,'placeholder.svg',(SELECT category_id FROM categories WHERE name='Storage'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('router','Wi-Fi Router','Dual-antenna wireless router, 300Mbps, easy browser setup. Covers a small home or office.',120000,10,'router.jpg',(SELECT category_id FROM categories WHERE name='Networking'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('switch8','8-Port Network Switch','Plug-and-play 10/100Mbps switch to connect computers and printers.',95000,5,'8-port network switch.jpg',(SELECT category_id FROM categories WHERE name='Networking'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('wifiadapter','USB Wi-Fi Adapter','Adds Wi-Fi to a desktop PC or older laptop. 150Mbps.',30000,3,'USB Wifi Adapter.jpg',(SELECT category_id FROM categories WHERE name='Networking'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('lan10','Ethernet Cable 10m (Cat6)','Flat Cat6 patch cable, 10 metres, for reliable wired connections.',15000,35,'placeholder.svg',(SELECT category_id FROM categories WHERE name='Networking'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('laptopbag','Laptop Bag 15.6"','Padded shoulder bag for laptops up to 15.6 inches, with accessory pockets.',65000,14,'laptopbag.jpg',(SELECT category_id FROM categories WHERE name='Bags'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('sleeve','Laptop Sleeve 14"','Slim water-resistant sleeve for laptops up to 14 inches.',35000,20,'laptop sleeve.jpg',(SELECT category_id FROM categories WHERE name='Bags'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('backpack','Laptop Backpack','Backpack with a padded laptop compartment, USB charging port and rain cover.',85000,0,'laptop backpack.jpg',(SELECT category_id FROM categories WHERE name='Bags'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('charger','Universal Laptop Charger 90W','Adjustable-voltage charger with 8 tips for most laptop brands.',90000,8,'universal laptop charger.jpg',(SELECT category_id FROM categories WHERE name='Power & cables'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('powerbank','Power Bank 10,000mAh','Dual USB output power bank with LED charge indicator.',70000,16,'power bank.jpg',(SELECT category_id FROM categories WHERE name='Power & cables'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('surge','4-Way Surge Protector','Extension socket with surge protection, 2m cable and master switch.',35000,24,'4-way surge protector.jpg',(SELECT category_id FROM categories WHERE name='Power & cables'));
INSERT INTO products (sku,name,description,price,stock,image,category_id) VALUES ('hdmi','HDMI Cable 2m','High-speed HDMI cable for monitors, TVs and projectors.',20000,30,'HDMS Cable.jpg',(SELECT category_id FROM categories WHERE name='Power & cables'));

-- customers
INSERT INTO customers (full_name,phone,email,address) VALUES
  ('Akampurira Brian','0761421472','brian@example.com','Kitagata Town, Sheema'),
  ('Nuwagaba Grace','0772300111',NULL,'Bushenyi University campus'),
  ('Tumusiime Peter','0701555222','peter@example.com','Mbarara City, High Street'),
  ('Atuhaire Joan','0782909333',NULL,NULL);

-- orders
INSERT INTO orders (order_no,customer_id,order_date,delivery_method,delivery_address,delivery_fee,status) VALUES
  ('TG-100001',1,'2026-10-20','collection',NULL,0,'Completed'),
  ('TG-100002',2,'2026-10-24','delivery','Bushenyi University campus, Hall 3',5000,'Shipped'),
  ('TG-100003',3,'2026-10-28','delivery','Mbarara City, High Street, Plot 12',5000,'Pending'),
  ('TG-100004',4,'2026-10-30','collection',NULL,0,'Confirmed');

-- order items (unit_price copied from products at time of sale)
INSERT INTO order_items (order_id,product_id,quantity,unit_price) SELECT (SELECT order_id FROM orders WHERE order_no='TG-100001'),product_id,1,price FROM products WHERE sku='keyboard';
INSERT INTO order_items (order_id,product_id,quantity,unit_price) SELECT (SELECT order_id FROM orders WHERE order_no='TG-100001'),product_id,1,price FROM products WHERE sku='mouse';
INSERT INTO order_items (order_id,product_id,quantity,unit_price) SELECT (SELECT order_id FROM orders WHERE order_no='TG-100002'),product_id,1,price FROM products WHERE sku='headphones';
INSERT INTO order_items (order_id,product_id,quantity,unit_price) SELECT (SELECT order_id FROM orders WHERE order_no='TG-100002'),product_id,2,price FROM products WHERE sku='flashdisk';
INSERT INTO order_items (order_id,product_id,quantity,unit_price) SELECT (SELECT order_id FROM orders WHERE order_no='TG-100003'),product_id,1,price FROM products WHERE sku='router';
INSERT INTO order_items (order_id,product_id,quantity,unit_price) SELECT (SELECT order_id FROM orders WHERE order_no='TG-100003'),product_id,2,price FROM products WHERE sku='lan10';
INSERT INTO order_items (order_id,product_id,quantity,unit_price) SELECT (SELECT order_id FROM orders WHERE order_no='TG-100004'),product_id,1,price FROM products WHERE sku='laptopbag';
INSERT INTO order_items (order_id,product_id,quantity,unit_price) SELECT (SELECT order_id FROM orders WHERE order_no='TG-100004'),product_id,1,price FROM products WHERE sku='powerbank';

-- payments
INSERT INTO payments (order_id,method,amount,status,paid_at) VALUES
  (1,'Cash at shop',70000,'Paid','2026-10-20'),
  (2,'Mobile money',116000,'Paid','2026-10-24'),
  (3,'Cash on delivery',155000,'Unpaid',NULL),
  (4,'Mobile money',135000,'Paid','2026-10-30');

COMMIT;
