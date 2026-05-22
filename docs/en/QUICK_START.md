# MeshKit Quick Start

[简体中文](../使用说明.md) | English

This guide is for first-time MeshKit users.

## 1. Startup

Development:

```bash
pnpm install
pnpm --filter core build
pnpm dev
```

Start modules separately:

```bash
pnpm dev:web
pnpm dev:desktop
pnpm dev:signaling
```

Desktop installers:

```bash
pnpm --filter desktop release:win
pnpm --filter desktop release:mac
```

`release:win` builds Windows installers, and `release:mac` builds macOS DMG/ZIP. macOS packages need to be built on macOS.

## 2. Screenshots

<p align="center">
  <img src="../images/filetransfer.png" alt="Peer-to-peer file transfer" width="46%">
  <img src="../images/filetransfer3.png" alt="Pickup-code receiving" width="46%">
</p>

<p align="center">
  <img src="../images/noteswall2.png" alt="Notes Wall" width="46%">
  <img src="../images/chat2.png" alt="Encrypted chat" width="46%">
</p>

More screenshots are available in [Feature Overview](./FEATURE_OVERVIEW.md).

## 3. File Transfer

### Peer-to-peer Sending

1. Open File Transfer.
2. Choose Peer-to-peer Transfer.
3. Select files or drag files into the page.
4. Select a target device.
5. Click Send.
6. Wait for the receiver to accept and mark completion.

### Peer-to-peer Receiving

1. Open File Transfer and keep the page online.
2. Click accept when a request appears.
3. For multi-file transfer, choose the files to receive.
4. Save files.
5. After saving everything, click Mark as Finished.

### Pickup-code Sending

1. Open File Transfer.
2. Choose Create Pickup Code.
3. Select files.
4. Send the pickup code, link, or QR code to the other side.
5. Keep the page open until the receiver finishes.

### Pickup-code Receiving

1. Choose Enter Pickup Code, or open the invite link directly.
2. Enter the pickup code and password if required.
3. Select and save files.
4. Click Mark as Finished after saving.

## 4. Notes Wall

1. Open Notes Wall.
2. Enter nickname and room ID, or use a recent room.
3. Optional: enable password and encryption settings.
4. Add, edit, and move notes after entering the room.
5. Use the share button to generate a link or QR code for other members.

Rules:

- Only the owner can destroy the room.
- Other members are notified after room destruction.
- On mobile, long-press before dragging the board.

## 5. Encrypted Chat

1. Open Encrypted Chat.
2. Enter nickname and room ID.
3. Optional: set a room password.
4. Start chatting after entering the room.
5. Use the share button to invite other members.

Rules:

- Only the owner can destroy the room.
- Other members leave after room destruction.
- Share invite links only with trusted people.

## 6. Desktop Share Hub

Desktop Settings can enable local sharing services and currently supports Windows and macOS.

Typical flow:

1. Open Desktop.
2. Go to Settings and enable Share Hub.
3. Copy the invite link or show the QR code.
4. A phone or another computer can open the link to enter the Web share page.

If someone sends you a MeshKit invite link, import it from Desktop Settings. Desktop will write the connection settings and jump to the matching feature.

## 7. FAQ

### Cannot see other devices

- Confirm both sides are on the same LAN.
- Confirm signaling or Desktop sharing service has started.
- Check firewall rules for Web, WebSocket, and PeerJS ports shown by Share Hub.
- On macOS, AirPlay Receiver may occupy `7000`; use the port shown in Settings.
- Try refreshing devices or RTC.

### Invite link cannot open

- Confirm the host IP in the link is reachable from the current device.
- If the link comes from Desktop, confirm Desktop sharing is still running.
- For phones, confirm the phone and computer are on the same Wi-Fi.

### Transfer interrupted

- Do not close the page or switch features during transfer.
- Try refreshing RTC and starting again.
- For large files, keep the screen awake and network stable.
