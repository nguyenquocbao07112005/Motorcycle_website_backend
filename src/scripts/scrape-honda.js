const puppeteer = require('puppeteer');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function scrapeHondaBigBikes() {
  console.log('Khởi động trình duyệt...');
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const targetUrl = 'https://www.honda.com.vn/xe-may/san-pham#xe-mo-to';
  await page.goto(targetUrl, { waitUntil: 'networkidle2' });

  // Cào danh sách xe
  let rawData = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('.category-item-content').forEach(item => {
      results.push({
        name: item.querySelector('h3')?.innerText.trim(),
        price: item.querySelector('.price span')?.innerText.trim(),
        imgUrl: item.querySelector('.thumb img')?.src,
        detailLink: item.href,
        brand: 'Honda'
      });
    });
    return results;
  });

  // TỰ ĐỘNG LỌC TRÙNG 
  const uniqueData = Array.from(new Map(rawData.map(item => [item.name, item])).values());
  console.log(`Tìm thấy ${rawData.length} xe, sau khi lọc trùng còn ${uniqueData.length} xe.`);

  // 3. Cào chi tiết và Lưu DB
  const detailPage = await browser.newPage();
  for (const bike of uniqueData) {
    console.log(`Đang lấy CC của: ${bike.name}`);
    bike.engineCc = await scrapeEngineCc(detailPage, bike.detailLink);
    await saveBikeToDatabase(bike); // Gọi hàm lưu từng xe
  }

  await browser.close();
  console.log('Hoàn tất cào và làm sạch dữ liệu!');
}

async function saveBikeToDatabase(bike) {
  const brand = await prisma.brand.upsert({ where: { name: 'Honda' }, update: {}, create: { name: 'Honda' } });
  const category = await prisma.category.upsert({ where: { name: 'Xe Mô tô' }, update: {}, create: { name: 'Xe Mô tô' } });

  const priceNumber = parseInt(bike.price.replace(/\D/g, '')) || 0;

  // Sử dụng deleteMany để dọn sạch bản ghi trùng cũ trước khi tạo mới 
  await prisma.motorcycle.deleteMany({ where: { name: bike.name } });

  await prisma.motorcycle.create({
    data: {
      name: bike.name,
      price: priceNumber,
      stockQuantity: 5,
      engineCc: bike.engineCc,
      brandId: brand.id,
      categoryId: category.id,
      images: { create: [{ imageUrl: bike.imgUrl, isPrimary: true }] }
    }
  });
  console.log(`Đã lưu: ${bike.name}`);
}

async function scrapeEngineCc(page, detailLink) {
  try {
    await page.goto(detailLink, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.spec-item', { timeout: 10000 });

    return await page.evaluate(() => {
      const specItems = Array.from(document.querySelectorAll('.spec-item'));
      
      const targetItem = specItems.find(item => {
        const label = item.querySelector('.spec-item-label')?.innerText.trim() || '';
        return label.includes('Dung tích xy-lanh');
      });

      if (targetItem) {
        let valueText = targetItem.querySelector('.spec-item-value p')?.innerText.trim() || '';
    
        let cleanText = valueText.replace(/\./g, '').replace(',', '.');
        
        // Trích xuất số
        const match = cleanText.match(/(\d+(\.\d+)?)/);
        
        if (match) {
          return Math.round(parseFloat(match[0]));
        }
      }
      return 0; 
    });
  } catch (error) {
    return 0;
  }
}

scrapeHondaBigBikes().catch(console.error).finally(() => prisma.$disconnect());