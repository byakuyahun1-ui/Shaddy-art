# Shaddy Art — Website

Ye ek simple art-selling website hai jisme:
- Public gallery jaha visitors artworks dekh sakte hain
- Admin panel jaha aap art add/edit/delete kar sakte ho, price change kar sakte ho, "sold" mark kar sakte ho

**Admin login:**
- Username: `Shaddy`
- Password: `jokekingmaker`

Ye pure Node.js mein likha gaya hai — **koi `npm install` ki zaroorat nahi**, sirf Node.js installed hona chahiye.

---

## Apne computer par chalane ke liye (testing)

1. [Node.js](https://nodejs.org) install karein (agar nahi hai to)
2. Terminal/CMD kholiye, is folder mein jayein:
   ```
   cd art-backend
   ```
3. Server start karein:
   ```
   node server.js
   ```
4. Browser mein kholiye: `http://localhost:3000`

Data `data/artworks.json` file mein save hota hai, aur upload ki hui images `public/uploads/` folder mein.

---

## Real website banane ke liye (deploy / hosting)

Aapko ek jagah chahiye jaha ye Node.js server 24x7 chal sake. Kuch aasan free/cheap options:

### Option 1: Render.com (sabse aasan, free tier available)
1. Apna code GitHub par upload karein
2. [render.com](https://render.com) par account banayein
3. "New Web Service" → apna GitHub repo connect karein
4. Build command: (khali chhod dein)
5. Start command: `node server.js`
6. Deploy karein — aapko ek public URL milega (jaise `shaddy-art.onrender.com`)

### Option 2: Railway.app
Similar process — GitHub repo connect karke deploy karein.

### Option 3: Apna VPS (jaise Hostinger, DigitalOcean)
1. Server par Node.js install karein
2. Files upload karein
3. `node server.js` chalayein (ya `pm2` use karein taaki crash hone par restart ho)
4. Domain point karein server ke IP par

**Zaroori baat:** Jahan bhi deploy karein, `data/` aur `public/uploads/` folders persist hone chahiye (delete na hon), warna aapki artworks/images gayab ho jayengi restart par. Render/Railway par "persistent disk" / "volume" add karna padta hai — free tier mein kabhi kabhi ye available nahi hota, is case mein paid tier ya VPS better rahega.

---

## Payment

Abhi "Buy" button dabane par sirf ek message dikhta hai ke payment jald hi aayega. Jab aap decide kar lein PayPal ya UPI/Razorpay mein se kya use karna hai, mujhe batayein — main integrate kar dunga.

---

## File structure

```
art-backend/
├── server.js           ← main backend server
├── data/
│   └── artworks.json   ← saari artworks ka data (auto-created)
├── public/
│   ├── index.html       ← website ka HTML
│   ├── app.js            ← frontend logic
│   └── uploads/          ← uploaded images yahan save hoti hain
└── README.md
```
