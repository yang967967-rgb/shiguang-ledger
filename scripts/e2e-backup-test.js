const endpoint = process.env.CHROME_DEBUG_URL || "http://127.0.0.1:9223";

async function connect() {
  const targets = await fetch(`${endpoint}/json`).then((response) => response.json());
  const target = targets.find((item) => item.type === "page" && item.url.includes("127.0.0.1:8080"));
  if (!target) throw new Error("Ledger browser target not found");

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let sequence = 0;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  function send(method, params = {}) {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  return { socket, send };
}

async function main() {
  const { socket, send } = await connect();
  const expression = `
    (async () => {
      localStorage.clear();
      transactions = [];
      updateDateDisplay();

      document.querySelector('#openEntryDialog').click();
      document.querySelector('#amount').value = '28.50';
      document.querySelector('#note').value = '备份测试';
      document.querySelector('#entryForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const firstBackup = JSON.parse(createBackup());
      if (firstBackup.appVersion !== '1.1.0') throw new Error('Wrong backup app version');
      if (firstBackup.transactionCount !== 1) throw new Error('Transaction was not exported');

      const importedRecord = {
        id: 'e2e-import-record',
        type: 'income',
        amount: 100,
        date: document.querySelector('#selectedDate').value,
        category: '兼职',
        note: '导入测试',
        createdAt: Date.now() + 1,
      };
      const importPayload = JSON.stringify({ format: 'shiguang-ledger-backup', transactions: [importedRecord] });
      window.confirm = () => true;
      document.querySelector('#openImportDialog').click();
      document.querySelector('#backupText').value = importPayload;
      await importBackup(new Event('submit', { cancelable: true }));

      const afterImport = JSON.parse(localStorage.getItem('shiguang-ledger-transactions-v1'));
      if (afterImport.length !== 2) throw new Error('Import did not add a record');

      document.querySelector('#openImportDialog').click();
      document.querySelector('#backupText').value = importPayload;
      await importBackup(new Event('submit', { cancelable: true }));
      const afterDuplicate = JSON.parse(localStorage.getItem('shiguang-ledger-transactions-v1'));
      if (afterDuplicate.length !== 2) throw new Error('Duplicate import was not skipped');

      return {
        exported: firstBackup.transactionCount,
        importedTotal: afterImport.length,
        duplicateSafeTotal: afterDuplicate.length,
      };
    })()
  `;

  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  socket.close();
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  console.log(JSON.stringify(result.result.value));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
