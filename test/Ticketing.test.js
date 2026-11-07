const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Blockchain Ticketing System", function () {
  let usdc, registry, ticketNFT, marketplace;
  let owner, organizer, buyer, buyer2;

  beforeEach(async function () {
    [owner, organizer, buyer, buyer2] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const EventRegistry = await ethers.getContractFactory("EventRegistry");
    registry = await EventRegistry.deploy();

    const TicketNFT = await ethers.getContractFactory("TicketNFT");
    ticketNFT = await TicketNFT.deploy(await registry.getAddress());

    const TicketMarketplace = await ethers.getContractFactory("TicketMarketplace");
    marketplace = await TicketMarketplace.deploy(
      await usdc.getAddress(),
      await registry.getAddress(),
      await ticketNFT.getAddress()
    );

    await ticketNFT.setMarketplace(await marketplace.getAddress());
    await registry.setMarketplace(await marketplace.getAddress());

    await usdc.connect(buyer).faucet(ethers.parseUnits("100", 6));
    await usdc.connect(buyer2).faucet(ethers.parseUnits("100", 6));
  });

  it("ينشئ المنظّم فعالية بحد إعادة بيع 110%", async function () {
    await registry.connect(organizer).createEvent("New Year's Party", ethers.parseUnits("10", 6), 100, 110);
    const ev = await registry.getEvent(0);
    expect(ev.resaleCapPercent).to.equal(110n);
  });

  it("يشتري المستخدم تذكرة بنجاح (شراء أساسي)", async function () {
    await registry.connect(organizer).createEvent("Party", ethers.parseUnits("10", 6), 100, 110);
    await usdc.connect(buyer).approve(await marketplace.getAddress(), ethers.parseUnits("10", 6));
    await marketplace.connect(buyer).buyTicket(0);
    expect(await ticketNFT.ownerOf(0)).to.equal(buyer.address);
  });

  it("يسمح بإعادة البيع ضمن الحد المسموح", async function () {
    await registry.connect(organizer).createEvent("Party", ethers.parseUnits("10", 6), 100, 110); // حد أقصى 11 USDC
    await usdc.connect(buyer).approve(await marketplace.getAddress(), ethers.parseUnits("10", 6));
    await marketplace.connect(buyer).buyTicket(0);

    await ticketNFT.connect(buyer).listForResale(0, ethers.parseUnits("11", 6)); // بالضبط الحد الأقصى
    await usdc.connect(buyer2).approve(await marketplace.getAddress(), ethers.parseUnits("11", 6));
    await marketplace.connect(buyer2).buyResaleTicket(0);

    expect(await ticketNFT.ownerOf(0)).to.equal(buyer2.address);
  });

  it("يرفض إعادة بيع تتجاوز الحد المسموح (الميزة الجديدة الأهم)", async function () {
    await registry.connect(organizer).createEvent("Party", ethers.parseUnits("10", 6), 100, 110); // حد أقصى 11 USDC
    await usdc.connect(buyer).approve(await marketplace.getAddress(), ethers.parseUnits("10", 6));
    await marketplace.connect(buyer).buyTicket(0);

    await ticketNFT.connect(buyer).listForResale(0, ethers.parseUnits("50", 6)); // محاولة تلاعب/scalping
    await usdc.connect(buyer2).approve(await marketplace.getAddress(), ethers.parseUnits("50", 6));

    await expect(marketplace.connect(buyer2).buyResaleTicket(0)).to.be.revertedWith(
      "Listed price exceeds organizer resale cap"
    );
  });

  it("يمنع إعادة البيع كلياً لو الحد = 0", async function () {
    await registry.connect(organizer).createEvent("No-Resale Event", ethers.parseUnits("10", 6), 100, 0);
    await usdc.connect(buyer).approve(await marketplace.getAddress(), ethers.parseUnits("10", 6));
    await marketplace.connect(buyer).buyTicket(0);

    await ticketNFT.connect(buyer).listForResale(0, ethers.parseUnits("10", 6));
    await usdc.connect(buyer2).approve(await marketplace.getAddress(), ethers.parseUnits("10", 6));

    await expect(marketplace.connect(buyer2).buyResaleTicket(0)).to.be.revertedWith(
      "Resale is disabled for this event"
    );
  });

  it("يمنع بيع تذاكر أكثر من الحد الأقصى (sold out)", async function () {
    await registry.connect(organizer).createEvent("Small Event", ethers.parseUnits("5", 6), 1, 100);
    await usdc.connect(buyer).approve(await marketplace.getAddress(), ethers.parseUnits("10", 6));
    await marketplace.connect(buyer).buyTicket(0);
    await expect(marketplace.connect(buyer2).buyTicket(0)).to.be.revertedWith("Event sold out");
  });

  it("tokenURI يرجّع Metadata حقيقية (JSON مُرمّز Base64) لا رابط فاضي", async function () {
    await registry.connect(organizer).createEvent("New Year's Party", ethers.parseUnits("10", 6), 100, 110);
    await usdc.connect(buyer).approve(await marketplace.getAddress(), ethers.parseUnits("10", 6));
    await marketplace.connect(buyer).buyTicket(0);

    const uri = await ticketNFT.tokenURI(0);
    expect(uri).to.include("data:application/json;base64,");

    const base64Json = uri.replace("data:application/json;base64,", "");
    const decoded = Buffer.from(base64Json, "base64").toString("utf8");
    const metadata = JSON.parse(decoded);

    expect(metadata.name).to.include("New Year's Party");
    expect(metadata.attributes.find((a) => a.trait_type === "Ticket ID").value).to.equal(0);
  });

  it("يمنع استخدام نفس التذكرة مرتين عند تسجيل الدخول", async function () {
    await registry.connect(organizer).createEvent("Party", ethers.parseUnits("5", 6), 10, 100);
    await usdc.connect(buyer).approve(await marketplace.getAddress(), ethers.parseUnits("5", 6));
    await marketplace.connect(buyer).buyTicket(0);

    await ticketNFT.checkIn(0);
    await expect(ticketNFT.checkIn(0)).to.be.revertedWith("Ticket already used");
  });
});
