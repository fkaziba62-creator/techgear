-- TechGear CRUD operations (run after schema.sql and seed.sql)
-- ===== CREATE =====
--@ C1 Add a new product
INSERT INTO products (sku,name,description,price,stock,image,category_id)
VALUES ('webcam','HD Webcam 1080p','USB webcam with built-in microphone.',80000,10,'placeholder.svg',
        (SELECT category_id FROM categories WHERE name='Input devices'));
--@ C2 Add a new customer
INSERT INTO customers (full_name,phone,email,address) VALUES ('Mugisha Allan','0753444888','allan@example.com','Kabwohe Town');
--@ C3 Place a new order with two items (and reduce stock)
INSERT INTO orders (order_no,customer_id,order_date,delivery_method,delivery_fee)
VALUES ('TG-100005',(SELECT customer_id FROM customers WHERE phone='0753444888'),'2026-11-01','collection',0);
INSERT INTO order_items (order_id,product_id,quantity,unit_price)
SELECT (SELECT order_id FROM orders WHERE order_no='TG-100005'),product_id,1,price FROM products WHERE sku IN ('webcam','mousepad');
UPDATE products SET stock = stock - 1 WHERE sku IN ('webcam','mousepad');
-- ===== READ =====
--@ R1 List all products with category (catalogue listing)
SELECT p.sku, p.name, c.name AS category, p.price, p.stock FROM products p JOIN categories c USING(category_id) ORDER BY c.name, p.name LIMIT 10;
--@ R2 Search products by keyword 'mouse'
SELECT sku, name, price FROM products WHERE name LIKE '%mouse%' OR description LIKE '%mouse%';
--@ R3 Filter: in-stock Storage products under UGX 100,000, cheapest first
SELECT p.name, p.price, p.stock FROM products p JOIN categories c USING(category_id) WHERE c.name='Storage' AND p.stock>0 AND p.price<=100000 ORDER BY p.price;
--@ R4 Product count and average price per category
SELECT c.name AS category, COUNT(*) AS products, ROUND(AVG(p.price)) AS avg_price FROM categories c JOIN products p USING(category_id) GROUP BY c.category_id ORDER BY products DESC;
--@ R5 Order summary view
SELECT * FROM v_order_summary ORDER BY order_no;
--@ R6 Items in order TG-100002
SELECT o.order_no, p.name, oi.quantity, oi.unit_price, oi.quantity*oi.unit_price AS line_total FROM order_items oi JOIN orders o USING(order_id) JOIN products p USING(product_id) WHERE o.order_no='TG-100002';
--@ R7 Low stock report (5 or fewer)
SELECT name, stock FROM products WHERE stock <= 5 ORDER BY stock;
-- ===== UPDATE =====
--@ U1 Change a product price
UPDATE products SET price = 42000 WHERE sku='keyboard';
--@ U2 Restock a product
UPDATE products SET stock = stock + 20 WHERE sku='gamingmouse';
--@ U3 Move an order forward and mark payment as paid
UPDATE orders SET status='Shipped' WHERE order_no='TG-100003';
UPDATE payments SET status='Paid', paid_at='2026-11-01' WHERE order_id=(SELECT order_id FROM orders WHERE order_no='TG-100003');
--@ U4 Check the updates
SELECT sku, price, stock FROM products WHERE sku IN ('keyboard','gamingmouse');
SELECT o.order_no, o.status, p.status AS payment FROM orders o JOIN payments p USING(order_id) WHERE o.order_no='TG-100003';
-- ===== DELETE =====
--@ D1 Cancel and delete an order (order_items are removed automatically by ON DELETE CASCADE)
UPDATE products SET stock = stock + 1 WHERE sku IN ('webcam','mousepad');  -- return stock
DELETE FROM orders WHERE order_no='TG-100005';
SELECT COUNT(*) AS items_left_for_TG_100005 FROM order_items WHERE order_id NOT IN (SELECT order_id FROM orders);
--@ D2 Delete a product that was never sold
DELETE FROM products WHERE sku='webcam';
--@ D3 Confirm deletions
SELECT COUNT(*) AS products FROM products;
