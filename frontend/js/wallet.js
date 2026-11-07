let web3;
let currentAccount = null;
let contracts = {};

async function connectWallet() {
  if (typeof window.ethereum === "undefined") {
    alert("يرجى تثبيت محفظة MetaMask أولاً");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    currentAccount = accounts[0];

    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== SEPOLIA_CHAIN_ID) {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID }] });
    }

    web3 = new Web3(window.ethereum);
    initContracts();

    document.getElementById("wallet-address").textContent = currentAccount.slice(0, 6) + "..." + currentAccount.slice(-4);
    document.getElementById("connect-btn").textContent = "متصل ✓";
    document.getElementById("connect-btn").disabled = true;

    await showProfileOrRoleSelect();

    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
  } catch (err) {
    console.error(err);
    alert("فشل الاتصال بالمحفظة: " + (err.message || err));
  }
}

function initContracts() {
  contracts.usdc = new web3.eth.Contract(USDC_ABI, CONTRACT_ADDRESSES.USDC);
  contracts.registry = new web3.eth.Contract(REGISTRY_ABI, CONTRACT_ADDRESSES.REGISTRY);
  contracts.ticketNFT = new web3.eth.Contract(TICKET_NFT_ABI, CONTRACT_ADDRESSES.TICKET_NFT);
  contracts.marketplace = new web3.eth.Contract(MARKETPLACE_ABI, CONTRACT_ADDRESSES.MARKETPLACE);
}

async function showProfileOrRoleSelect() {
  const seenKey = "profile_done_" + currentAccount.toLowerCase();
  if (localStorage.getItem(seenKey)) {
    document.getElementById("role-select").classList.remove("hidden");
    return;
  }
  document.getElementById("profile-setup").classList.remove("hidden");
}

document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("profile-name").value;
  const email = document.getElementById("profile-email").value;
  try {
    await fetch(`${BACKEND_URL}/users`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet_address: currentAccount, name, email }),
    });
  } catch (err) {
    console.warn("تعذّر حفظ الملف الشخصي بالـ backend (سيُحفظ محلياً فقط):", err.message);
  }
  localStorage.setItem("profile_done_" + currentAccount.toLowerCase(), "1");
  document.getElementById("profile-setup").classList.add("hidden");
  document.getElementById("role-select").classList.remove("hidden");
});

document.getElementById("connect-btn").addEventListener("click", connectWallet);
