/**
 * ============================================================
 * CHUNKED BLOCKCHAIN EVENT READER
 * File: frontend/js/chain-utils.js
 * Network: Sepolia
 * ============================================================
 *
 * Fetches past smart-contract events in small block ranges.
 * Stops and reports an error if any RPC request fails.
 */

/**
 * Fetch historical events in chunks.
 *
 * @param {Object} contract - Web3 contract instance
 * @param {string} eventName - Contract event name
 * @param {Object} options - fromBlock, toBlock, filter
 * @returns {Promise<Array>} All matching events
 */
async function getPastEventsChunked(
  contract,
  eventName,
  options = {}
) {
  
  const CHUNK_SIZE = 500;

  // Check that Web3 is available
  if (typeof web3 === "undefined" || !web3.eth) {
    throw new Error(
      "Web3 is not initialized. Please connect to Sepolia."
    );
  }

  // Check the contract instance
  if (
    !contract ||
    typeof contract.getPastEvents !== "function"
  ) {
    throw new Error(
      "Invalid contract instance or missing getPastEvents method."
    );
  }

  // Determine the starting block
  const configuredDeployBlock =
    typeof DEPLOY_BLOCK !== "undefined"
      ? DEPLOY_BLOCK
      : 12084450;

  const fromBlock = Number(
    options.fromBlock ?? configuredDeployBlock
  );

  // Determine the ending block
  let toBlock;

  if (
    options.toBlock === undefined ||
    options.toBlock === "latest"
  ) {
    toBlock = Number(await web3.eth.getBlockNumber());
  } else {
    toBlock = Number(options.toBlock);
  }

  // Validate block range
  if (
    !Number.isSafeInteger(fromBlock) ||
    !Number.isSafeInteger(toBlock) ||
    fromBlock < 0 ||
    toBlock < fromBlock
  ) {
    throw new Error(
      `Invalid block range: ${fromBlock}-${toBlock}`
    );
  }

  const allEvents = [];

  console.info(
    `Loading ${eventName}: blocks ${fromBlock}-${toBlock}`
  );

  // Fetch events in smaller ranges
  for (
    let start = fromBlock;
    start <= toBlock;
    start += CHUNK_SIZE
  ) {
    const end = Math.min(
      start + CHUNK_SIZE - 1,
      toBlock
    );

    try {
      const chunkEvents = await contract.getPastEvents(
        eventName,
        {
          fromBlock: start,
          toBlock: end,
          ...(options.filter
            ? { filter: options.filter }
            : {}),
        }
      );

      allEvents.push(...chunkEvents);

      console.info(
        `${eventName}: blocks ${start}-${end}, ` +
        `${chunkEvents.length} events found`
      );
    } catch (error) {
      console.error(
        `Failed to fetch ${eventName} ` +
        `for blocks ${start}-${end}:`,
        error
      );

      throw new Error(
        `Failed to load ${eventName} at blocks ` +
        `${start}-${end}. Check your Sepolia RPC provider, ` +
        `contract address, ABI, and network connection.`
      );
    }
  }

  console.info(
    `Finished loading ${eventName}. ` +
    `Total events: ${allEvents.length}`
  );

  return allEvents;
}