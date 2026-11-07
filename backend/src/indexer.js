const { Web3 } = require("web3");
const pool = require("./db");
const {
  REGISTRY_ABI,
  MARKETPLACE_ABI,
  TICKET_NFT_ABI,
} = require("./abi");

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const web3 = new Web3(process.env.SEPOLIA_RPC_URL);

const registry = new web3.eth.Contract(
  REGISTRY_ABI,
  process.env.REGISTRY_ADDRESS
);

const marketplace = new web3.eth.Contract(
  MARKETPLACE_ABI,
  process.env.MARKETPLACE_ADDRESS
);

const ticketNFT = new web3.eth.Contract(
  TICKET_NFT_ABI,
  process.env.TICKET_NFT_ADDRESS
);

const POLL_INTERVAL_MS = 15_000;

// Alchemy Free: maximum 10 blocks per eth_getLogs request.
const MAX_BLOCK_RANGE = 10;

async function getLastProcessedBlock(name, deployBlock) {
  const res = await pool.query(
    `SELECT last_processed_block
     FROM indexer_state
     WHERE contract_name = $1`,
    [name]
  );

  if (res.rows.length === 0) {
    await pool.query(
      `INSERT INTO indexer_state
       (contract_name, last_processed_block)
       VALUES ($1, $2)`,
      [name, deployBlock]
    );

    return deployBlock;
  }

  return Number(res.rows[0].last_processed_block);
}

async function setLastProcessedBlock(name, block) {
  await pool.query(
    `UPDATE indexer_state
     SET last_processed_block = $1
     WHERE contract_name = $2`,
    [block, name]
  );
}

async function getBlockRange(name, deployBlock) {
  const lastProcessed = await getLastProcessedBlock(
    name,
    deployBlock
  );

  const fromBlock = lastProcessed + 1;
  const latest = Number(await web3.eth.getBlockNumber());

  if (fromBlock > latest) {
    return null;
  }

  // Inclusive range: at most 10 blocks.
  const toBlock = Math.min(
    fromBlock + MAX_BLOCK_RANGE - 1,
    latest
  );

  console.log(
    `[${name}] معالجة البلوكات ${fromBlock} إلى ${toBlock}`
  );

  return { fromBlock, toBlock };
}

async function processRegistryEvents() {
  const deployBlock = Number(process.env.DEPLOY_BLOCK || 0);
  const range = await getBlockRange("registry", deployBlock);

  if (!range) return;

  const { fromBlock, toBlock } = range;

  const created = await registry.getPastEvents("EventCreated", {
    fromBlock,
    toBlock,
  });

  for (const log of created) {
    const {
      eventId,
      organizer,
      name,
      price,
      maxTickets,
      resaleCapPercent,
    } = log.returnValues;

    await pool.query(
      `INSERT INTO events
       (event_id, organizer_address, name, price_units,
        max_tickets, resale_cap_percent, tx_hash, block_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        eventId,
        organizer.toLowerCase(),
        name,
        price,
        maxTickets,
        resaleCapPercent,
        log.transactionHash,
        log.blockNumber,
      ]
    );

    console.log(`[registry] فعالية جديدة #${eventId}: ${name}`);
  }

  const statusChanged = await registry.getPastEvents(
    "EventStatusChanged",
    { fromBlock, toBlock }
  );

  for (const log of statusChanged) {
    await pool.query(
      "UPDATE events SET active = $1 WHERE event_id = $2",
      [log.returnValues.active, log.returnValues.eventId]
    );
  }

  await setLastProcessedBlock("registry", toBlock);
}

async function processMarketplaceEvents() {
  const deployBlock = Number(process.env.DEPLOY_BLOCK || 0);
  const range = await getBlockRange("marketplace", deployBlock);

  if (!range) return;

  const { fromBlock, toBlock } = range;

  const purchases = await marketplace.getPastEvents(
    "TicketPurchased",
    { fromBlock, toBlock }
  );

  for (const log of purchases) {
    const { eventId, tokenId, buyer, pricePaid } = log.returnValues;

    await pool.query(
      `INSERT INTO tickets
       (token_id, event_id, owner_address, purchase_price_units, tx_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (token_id) DO NOTHING`,
      [
        tokenId,
        eventId,
        buyer.toLowerCase(),
        pricePaid,
        log.transactionHash,
      ]
    );

    // Avoid incrementing tickets_sold for duplicate events.
    // The INSERT above ignores already indexed token IDs.
    // The counter should be reconciled separately if needed.
    console.log(
      `[marketplace] تمت معالجة التذكرة #${tokenId} للفعالية #${eventId}`
    );
  }

  const resales = await marketplace.getPastEvents(
    "TicketResalePurchased",
    { fromBlock, toBlock }
  );

  for (const log of resales) {
    const { tokenId, buyer } = log.returnValues;

    await pool.query(
      `UPDATE tickets
       SET owner_address = $1, resale_listing_price = 0
       WHERE token_id = $2`,
      [buyer.toLowerCase(), tokenId]
    );

    console.log(
      `[marketplace] إعادة بيع التذكرة #${tokenId}`
    );
  }

  await setLastProcessedBlock("marketplace", toBlock);
}

async function processTicketNftEvents() {
  const deployBlock = Number(process.env.DEPLOY_BLOCK || 0);
  const range = await getBlockRange("ticketNFT", deployBlock);

  if (!range) return;

  const { fromBlock, toBlock } = range;

  const transfers = await ticketNFT.getPastEvents("Transfer", {
    fromBlock,
    toBlock,
  });

  for (const log of transfers) {
    const { from, to, tokenId } = log.returnValues;

    // Skip mint events; purchase events handle initial ownership.
    if (
      from.toLowerCase() ===
      "0x0000000000000000000000000000000000000000"
    ) {
      continue;
    }

    await pool.query(
      "UPDATE tickets SET owner_address = $1 WHERE token_id = $2",
      [to.toLowerCase(), tokenId]
    );
  }

  const checkins = await ticketNFT.getPastEvents(
    "TicketCheckedIn",
    { fromBlock, toBlock }
  );

  for (const log of checkins) {
    await pool.query(
      `UPDATE tickets
       SET checked_in = TRUE, checked_in_at = NOW()
       WHERE token_id = $1`,
      [log.returnValues.tokenId]
    );
  }

  const listed = await ticketNFT.getPastEvents(
    "TicketListedForResale",
    { fromBlock, toBlock }
  );

  for (const log of listed) {
    await pool.query(
      `UPDATE tickets
       SET resale_listing_price = $1
       WHERE token_id = $2`,
      [log.returnValues.price, log.returnValues.tokenId]
    );
  }

  const cancelled = await ticketNFT.getPastEvents(
    "TicketResaleCancelled",
    { fromBlock, toBlock }
  );

  for (const log of cancelled) {
    await pool.query(
      `UPDATE tickets
       SET resale_listing_price = 0
       WHERE token_id = $1`,
      [log.returnValues.tokenId]
    );
  }

  await setLastProcessedBlock("ticketNFT", toBlock);
}

async function runIndexerLoop() {
  try {
    await processRegistryEvents();
    await processMarketplaceEvents();
    await processTicketNftEvents();
  } catch (err) {
    console.error("خطأ بدورة الـ Indexer:", err.message);
  } finally {
    setTimeout(runIndexerLoop, POLL_INTERVAL_MS);
  }
}

function startIndexer() {
  console.log("🔄 بدء تشغيل الـ Indexer");
  runIndexerLoop();
}

module.exports = { startIndexer };