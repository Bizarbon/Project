# TechEcommerce Typography

## Google Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@500;600;700&display=swap&subset=vietnamese"
>
```

## CSS variables

```css
:root {
  --font-heading: "Montserrat", Arial, sans-serif;
  --font-body: "Inter", "Segoe UI", sans-serif;
}

body {
  font-family: var(--font-body);
  font-weight: 400;
}

h1,
h2,
h3,
h4,
h5,
h6,
.product-name,
.banner-title {
  font-family: var(--font-heading);
}
```

## Tailwind CSS (optional)

The current project does not use Tailwind CSS. If Tailwind is added later, merge this configuration into `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./frontend/**/*.{html,js}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Montserrat', 'Arial', 'sans-serif'],
        body: ['Inter', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};
```

## Product Card preview

```html
<article class="type-product-card">
  <img src="https://placehold.co/640x420" alt="Laptop TechBook Pro 14 màu bạc">
  <section class="type-product-content">
    <h2 class="product-name">TechBook Pro 14</h2>
    <p class="product-price">24.990.000 đ</p>
    <ul class="product-specs">
      <li>Intel Core Ultra 7, RAM 16 GB</li>
      <li>SSD 512 GB, màn hình 14 inch 2.8K</li>
    </ul>
    <button type="button">Thêm vào giỏ</button>
  </section>
</article>
```

```css
.type-product-card {
  width: min(100%, 340px);
  overflow: hidden;
  border: 1px solid #d8e6f5;
  border-radius: 8px;
  background: #fff;
  color: #10233f;
}

.type-product-card img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
}

.type-product-content {
  padding: 20px;
}

.product-name {
  margin: 0 0 8px;
  font: 600 1.25rem/1.35 var(--font-heading);
}

.product-price {
  margin: 0 0 12px;
  color: #1672d4;
  font: 600 1.2rem/1.4 var(--font-body);
}

.product-specs {
  margin: 0 0 18px;
  padding-left: 20px;
  color: #52657d;
  font: 400 0.9rem/1.6 var(--font-body);
}

.type-product-card button {
  width: 100%;
  min-height: 44px;
  border: 0;
  border-radius: 6px;
  color: #fff;
  background: #2f80ed;
  font: 600 0.95rem/1 var(--font-body);
  cursor: pointer;
}
```
