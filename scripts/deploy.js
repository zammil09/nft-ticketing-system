const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("النشر باستخدام الحساب:", deployer.address);

  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("MockUSDC deployed:", await usdc.getAddress());

  const EventRegistry = await hre.ethers.getContractFactory("EventRegistry");
  const registry = await EventRegistry.deploy();
  await registry.waitForDeployment();
  console.log("EventRegistry deployed:", await registry.getAddress());

  const TicketNFT = await hre.ethers.getContractFactory("TicketNFT");
  const ticketNFT = await TicketNFT.deploy(await registry.getAddress()); // يحتاج عنوان Registry لقراءة اسم الفعالية بالـ Metadata
  await ticketNFT.waitForDeployment();
  console.log("TicketNFT deployed:", await ticketNFT.getAddress());

  const TicketMarketplace = await hre.ethers.getContractFactory("TicketMarketplace");
  const marketplace = await TicketMarketplace.deploy(
    await usdc.getAddress(),
    await registry.getAddress(),
    await ticketNFT.getAddress()
  );
  await marketplace.waitForDeployment();
  console.log("TicketMarketplace deployed:", await marketplace.getAddress());

  await (await ticketNFT.setMarketplace(await marketplace.getAddress())).wait();
  await (await registry.setMarketplace(await marketplace.getAddress())).wait();
  console.log("تم ربط صلاحيات Marketplace بنجاح");

  console.log("\n===== انسخ هذي العناوين إلى frontend/js/config.js و backend/.env =====");
  console.log("0x08362afC1ee6859E847a33f44e89fDa6b3eD82b8", await usdc.getAddress());
  console.log("0xFb62e4738e78f3fB05cE1AD842Bf6C7832475091", await registry.getAddress());
  console.log("0xDC2Ea708c210D3A7D46ddc2f31Afe3667995a4E9", await ticketNFT.getAddress());
  console.log("0x465E660c599BadC904aD37f6Be5Cfa8d673F3Fc3", await marketplace.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
