# 🏦 Monopoly Digital Banking
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-yellow.svg?style=flat-square&logo=buy-me-a-coffee)](https://buymeacoffee.com/tnyligokhan)

> 🇹🇷 Türkçe dokümantasyon için [buraya tıklayın](README.tr.md).

> **Monopoly Digital Banking** (formerly Monopoly Mobile Banking) is a modern, real-time **digital banking** application developed for the Monopoly board game. Forget paper money, manage your transactions from your pocket with the **Monopoly Digital Banking** experience!

![Version](https://img.shields.io/badge/version-1.2.1-blue.svg?style=flat&logo=git)
![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat)
![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=flat&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ecf8e.svg?style=flat&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000.svg?style=flat&logo=vercel&logoColor=white)

## 🌟 About The Project

**Monopoly Digital Banking** is a free web application that eliminates the clutter of paper money in the classic Monopoly game, allowing players to transfer money to each other or the bank in seconds. It carries the features of **Monopoly Digital Banking** while offering a unique gaming pleasure with its modern interface.

Thanks to the Supabase infrastructure, all transactions are synchronized in **Realtime**. When a player sends money, the other party's balance is updated instantly. Whether you call it Monopoly Digital Banking or electronic bank, your game is now much faster!

## ✨ Key Features

- **⚡ Real-Time Banking:** Transfers are instantly reflected on all players' screens.
- **🎮 Game Management:** Create a new game, join via code, and lobby system.
- **💸 Easy Transfer:** Fast transfer options between players, from bank to player, or player to bank.
- **🅿️ Parking Pool:** Mechanism to collect and manage money accumulated in the middle (Free Parking).
- **📊 Statistics:** Won games, total play time, and detailed transaction history.
- **🔐 Secure Login:** Register with E-mail or Guest (Anonymous) login option.
- **📱 Mobile Compatible:** Responsive design that works perfectly on phones and tablets.

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite
- **State Management:** Zustand
- **Backend & Database:** Supabase (PostgreSQL)
- **Realtime:** Supabase Realtime Channels
- **Icons:** Lucide React
- **Notifications:** React Hot Toast
- **Style:** Modern CSS Client & Variables

## 🚀 Installation & Setup

Follow these steps to run the project in your local environment:

### 1. Clone the Project
```bash
git clone https://github.com/tnyligokhan/Monopoly-Digital-Bank.git
cd Monopoly-Digital-Bank
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Environment Variables
Create a `.env` file in the root directory and enter your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Prepare Database
Go to the **SQL Editor** section in your Supabase panel and paste & run the content of the `supabase-schema.sql` file located in the project. This will create the necessary tables and security policies (RLS).

### 5. Start the Application
```bash
npm run dev
```

## 📸 Screenshots

<p align="center">
  <img src="assets/screenshots/1.jpeg" width="30%" alt="Screenshot 1">
  <img src="assets/screenshots/2.jpeg" width="30%" alt="Screenshot 2">
  <img src="assets/screenshots/3.jpeg" width="30%" alt="Screenshot 3">
</p>
<p align="center">
  <img src="assets/screenshots/4.jpeg" width="30%" alt="Screenshot 4">
  <img src="assets/screenshots/5.jpeg" width="30%" alt="Screenshot 5">
  <img src="assets/screenshots/6.jpeg" width="30%" alt="Screenshot 6">
</p>

## 🤝 Contribution

1. Fork this repo
2. Create a new feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Added new feature'`)
4. Push to the Branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the [MIT](LICENSE) license.

---
Developed by **Gökhan Ton**

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/tnyligokhan)
