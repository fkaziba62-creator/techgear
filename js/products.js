// Week 5 product catalogue: id, name, category, price (UGX), stock, image, description
const CATEGORIES = ["Audio","Bags","Input devices","Networking","Power & cables","Storage"];
const PRODUCTS = Object.fromEntries([
["keyboard","USB Keyboard","Input devices",42000,25,"keyboard.jpg","Full-size wired keyboard with numeric keypad and quiet keys. Plug and play on Windows, Linux and macOS."],
["mouse","Wireless Mouse","Input devices",25000,40,"mouse.jpg","2.4GHz wireless optical mouse with USB receiver. Needs 1 AA battery (included)."],
["combo","Wireless Keyboard & Mouse Combo","Input devices",75000,12,"wireless%20keyboard%20%26%20mouse%20combo.jpg","Spill-resistant keyboard and mouse sharing one USB receiver. Ideal for office and home use."],
["gamingmouse","Gaming Mouse 3200 DPI","Input devices",40000,20,"gaming%20mouse.jpg","Wired mouse with 6 buttons, adjustable DPI and LED lighting."],
["mousepad","Mouse Pad (Large)","Input devices",8000,60,"mouse%20pad.jpg","Non-slip rubber base, smooth cloth surface, 30 x 25 cm."],
["headphones","Stereo Headphones","Audio",55000,18,"headphones.jpg","Over-ear headphones with padded cushions and 3.5mm jack. Good for lectures and music."],
["earphones","Wired Earphones with Mic","Audio",15000,50,"wired%20Earphones%20with%20mic.jpg","In-ear earphones with inline microphone and 3 sizes of ear tips."],
["usbheadset","USB Headset with Microphone","Audio",60000,9,"USB%20Headset%20with%20microphone.jpg","Noise-reducing microphone for online classes and video calls. USB plug, no driver needed."],
["speaker","Bluetooth Speaker","Audio",85000,7,"placeholder.svg","Portable speaker with 8 hours of playback, USB-C charging and microphone."],
["flashdisk","Flash Disk 32GB","Storage",28000,80,"flashdisk.jpg","USB 3.0 flash drive with fast transfers. Fits in a pocket."],
["flashdisk64","Flash Disk 64GB","Storage",40000,45,"flashdisk.jpg","USB 3.0 flash drive, 64GB. Good for backups and large project files."],
["hdd500","Portable Hard Drive 500GB","Storage",190000,6,"placeholder.svg","USB 3.0 external drive, 500GB, with protective case and cable."],
["microsd","MicroSD Card 128GB","Storage",45000,22,"placeholder.svg","Class 10 memory card for phones, cameras and tablets, with SD adapter."],
["router","Wi-Fi Router","Networking",120000,10,"router.jpg","Dual-antenna wireless router, 300Mbps, easy browser setup. Covers a small home or office."],
["switch8","8-Port Network Switch","Networking",95000,5,"8-port%20network%20switch.jpg","Plug-and-play 10/100Mbps switch to connect computers and printers."],
["wifiadapter","USB Wi-Fi Adapter","Networking",30000,3,"USB%20Wifi%20Adapter.jpg","Adds Wi-Fi to a desktop PC or older laptop. 150Mbps."],
["lan10","Ethernet Cable 10m (Cat6)","Networking",15000,35,"placeholder.svg","Flat Cat6 patch cable, 10 metres, for reliable wired connections."],
["laptopbag","Laptop Bag 15.6\"","Bags",65000,14,"laptopbag.jpg","Padded shoulder bag for laptops up to 15.6 inches, with accessory pockets."],
["sleeve","Laptop Sleeve 14\"","Bags",35000,20,"laptop%20sleeve.jpg","Slim water-resistant sleeve for laptops up to 14 inches."],
["backpack","Laptop Backpack","Bags",85000,0,"laptop%20backpack.jpg","Backpack with a padded laptop compartment, USB charging port and rain cover."],
["charger","Universal Laptop Charger 90W","Power & cables",90000,8,"universal%20laptop%20charger.jpg","Adjustable-voltage charger with 8 tips for most laptop brands."],
["powerbank","Power Bank 10,000mAh","Power & cables",70000,16,"power%20bank.jpg","Dual USB output power bank with LED charge indicator."],
["surge","4-Way Surge Protector","Power & cables",35000,24,"4-way%20surge%20protector.jpg","Extension socket with surge protection, 2m cable and master switch."],
["hdmi","HDMI Cable 2m","Power & cables",20000,30,"HDMS%20Cable.jpg","High-speed HDMI cable for monitors, TVs and projectors."]
].map(p=>[p[0],{id:p[0],name:p[1],cat:p[2],price:p[3],stock:p[4],image:p[5],desc:p[6]}]));
