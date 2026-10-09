// src/lib/legalDefaults.ts — the built-in Terms and Conditions, Privacy
// Policy and Refund & Return Policy, used until staff edit a page in the back
// office. Written for an online shop in Kenya. {{placeholders}} are filled in
// from the shop's settings (see lib/legal.ts). Have a qualified advocate
// review the final wording before relying on it.

const terms = `
<p><strong>Effective date: {{last_updated}}</strong></p>
<p>These Terms and Conditions ("<strong>Terms</strong>") govern your use of the {{store_name}} website at {{website}} and any purchase you make from us. "<strong>We</strong>", "<strong>us</strong>" and "<strong>our</strong>" mean {{store_name}}; "<strong>you</strong>" means the person using the website or buying from us. Please read these Terms carefully. By creating an account, placing an order or otherwise using the website, you agree to be bound by them. If you do not agree, please do not use the website.</p>

<h2>1. About us and how to contact us</h2>
<p>{{store_name}} operates this online shop. {{contact_sentence}} Written notices to us should be sent to {{store_email}} or {{store_address}}.</p>

<h2>2. Eligibility</h2>
<p>You must be at least 18 years old and able to enter into a binding contract to place an order. If you are under 18, you may use the website only with the involvement and consent of a parent or guardian, who is responsible for any order placed. By placing an order you confirm that the information you give us is true, accurate and complete.</p>

<h2>3. Your account</h2>
<ul>
<li>You are responsible for keeping your password confidential and for all activity under your account. Tell us immediately if you suspect unauthorised use.</li>
<li>We may ask you to confirm your email address before you can sign in.</li>
<li>We may suspend or close an account, refuse service or cancel orders where we reasonably believe there has been fraud, abuse, a breach of these Terms or a risk to our customers, staff or business.</li>
<li>Staff who help you with your account do so on your behalf and under our control; their access is recorded.</li>
</ul>

<h2>4. Products and information</h2>
<p>We take care to describe and show our products accurately. Colours, sizes and finishes may vary slightly from images because of screen settings and natural variation in materials. Product descriptions, specifications and images are for guidance and do not form part of the contract unless expressly stated. All products are subject to availability.</p>

<h2>5. Orders and how the contract is formed</h2>
<ul>
<li>Your order is an offer to buy the products in it. When you place an order you will receive an order number and a confirmation email; this confirms that we have <em>received</em> your order, not that we have accepted it.</li>
<li>A contract between you and us is formed only when we accept your order by starting to prepare or dispatching it, or by confirming acceptance in writing.</li>
<li>We may decline or cancel an order (in whole or in part) before acceptance, including where a product is unavailable, a price or description is clearly wrong, payment cannot be verified, we suspect fraud or misuse, or delivery to your address is not possible. If you have already paid for anything we cannot supply, we refund you in full.</li>
<li>We may limit the quantity of any product sold to one customer, household or address.</li>
</ul>

<h2>6. Prices, tax and pricing errors</h2>
<p>Prices are shown in {{currency}}. {{prices_tax_sentence}} Delivery charges, gift wrapping and any other charges are shown before you pay.</p>
<p>Despite our efforts, a small number of products may be mispriced. If the correct price is lower, we charge the lower amount. If the correct price is higher, or the error is obvious and unmistakable, we will contact you to ask whether you wish to continue at the correct price or cancel; we are not obliged to supply products at an incorrect price.</p>
<p>Promotional prices, promo codes and vouchers are subject to their own conditions (such as minimum spend, eligible products and expiry dates), cannot be exchanged for cash and may be withdrawn at any time. We may refuse or reverse a discount obtained in breach of its conditions.</p>

<h2>7. Payment</h2>
<ul>
<li>We accept the payment methods shown at checkout, which may include card payments (processed by Stripe), M-Pesa, bank transfer and cash on delivery.</li>
<li>Card details are handled by our payment provider and are never stored by us.</li>
<li>You confirm that you are authorised to use the payment method you choose. We may carry out security and fraud checks and may cancel an order that fails them.</li>
<li>Where you pay against an invoice (for example by M-Pesa or bank transfer), payment is due by the date shown on the invoice. We may hold dispatch until payment is received.</li>
<li>Cash on delivery orders must be paid in full when the order is handed over. We may refuse cash on delivery for any order.</li>
</ul>

<h2>8. Delivery and collection</h2>
<ul>
<li>We deliver to the address you give us using the delivery option you choose. Delivery times are estimates and are not guaranteed; we are not responsible for delays outside our reasonable control.</li>
<li>Someone must be available to receive the order. If delivery fails because of incorrect details or no one being available, we may charge for re-delivery or cancel the order and refund you less delivery costs.</li>
<li>For pick-up orders, bring your order number and identification. Orders not collected within 14 days may be cancelled and refunded less any reasonable costs.</li>
<li>Risk of loss or damage passes to you when the goods are delivered to you or to the person you nominate, or when you collect them. Ownership passes to you when we have received payment in full.</li>
<li>Please check your order on delivery and tell us about any visible damage, missing items or wrong items within 48 hours.</li>
</ul>

<h2>9. Gifts</h2>
<p>If you send an item as a gift, we print your message on the packing slip, leave prices off it and wrap the item in the gift box you choose. You are responsible for the content of gift messages, which must not be unlawful, offensive or infringe anyone's rights; we may decline to print a message. Gift box charges are shown at checkout and are refundable only if the gift box itself was faulty or not supplied.</p>

<h2>10. Cancellations, returns and refunds</h2>
<p>You may cancel an order before it is dispatched. Returns and refunds are governed by our <a href="/policies/refunds">Refund &amp; Return Policy</a>, which forms part of these Terms. Nothing in these Terms affects your statutory rights as a consumer under the Consumer Protection Act, 2012 and other applicable law.</p>

<h2>11. Warranties</h2>
<p>We warrant that products will match their description and be of satisfactory quality and fit for their ordinary purpose when delivered, as required by law. Some products carry a manufacturer's warranty, the terms of which are set by the manufacturer. Except as stated in these Terms or required by law, all other warranties, conditions and representations, whether express or implied, are excluded to the fullest extent permitted by law. We do not warrant that the website will be uninterrupted, error-free or free of harmful components.</p>

<h2>12. Limitation of liability</h2>
<p>Nothing in these Terms limits or excludes our liability for death or personal injury caused by our negligence, for fraud, or for any liability that cannot be limited or excluded under Kenyan law, including your rights under the Consumer Protection Act, 2012.</p>
<p>Subject to the paragraph above:</p>
<ul>
<li>we are not liable for any loss that was not reasonably foreseeable when the contract was formed, or for any indirect or consequential loss, loss of profit, revenue, business, goodwill, data or opportunity;</li>
<li>we are not liable for losses caused by your failure to follow product instructions, misuse, normal wear and tear, or modification of a product;</li>
<li>we are not liable for any failure or delay caused by events outside our reasonable control (see clause 17); and</li>
<li>our total liability to you in connection with any order is limited to the total amount you paid for that order.</li>
</ul>
<p>Products are sold for domestic and private use. If you use them for any commercial or resale purpose, we have no liability to you for any loss of profit, business or business opportunity.</p>

<h2>13. Your responsibilities and acceptable use</h2>
<p>You agree not to:</p>
<ul>
<li>use the website in any way that is unlawful or fraudulent, or in connection with any unlawful or fraudulent purpose;</li>
<li>place orders you do not intend to pay for, or use another person's payment method or account without permission;</li>
<li>attempt to gain unauthorised access to the website, our systems or other customers' accounts, or interfere with their proper working (including by introducing viruses or by scraping, crawling or automated collection of content), contrary to the Computer Misuse and Cybercrimes Act, 2018;</li>
<li>resell our products in breach of any quantity limits, or misuse promotions; or</li>
<li>post content that is defamatory, obscene, offensive, misleading or that infringes anyone's rights.</li>
</ul>
<p>You agree to indemnify us against any claims, losses, costs (including reasonable legal costs) and liabilities arising from your breach of these Terms or misuse of the website.</p>

<h2>14. Reviews and content you submit</h2>
<p>Reviews, ratings, questions and other content you submit must be honest, relate to the product and comply with clause 13. You grant us a non-exclusive, worldwide, royalty-free, perpetual licence to use, reproduce, edit, publish and display that content in connection with our business, and you waive any moral rights in it to the extent permitted by law. We may moderate, edit or remove any content at our discretion.</p>

<h2>15. Intellectual property</h2>
<p>The website and its content, including text, images, logos, designs, graphics, software and the {{store_name}} name and brand, belong to us or our licensors and are protected by intellectual property laws. You may view and print pages for your personal, non-commercial use only. You may not copy, reproduce, modify, distribute or commercially exploit any part of the website without our prior written consent.</p>

<h2>16. Third-party services and links</h2>
<p>Payments, deliveries, email and sign-in with Google are provided by third parties under their own terms. Links to other websites are provided for convenience only; we do not control and are not responsible for their content, products or practices.</p>

<h2>17. Events outside our control</h2>
<p>We are not responsible for any failure or delay in performing our obligations caused by events outside our reasonable control, including natural disasters, epidemics, government action, civil unrest, strikes, power or internet outages, failures of payment, courier or other third-party services, or supply shortages. If such an event continues for more than 30 days, either of us may cancel the affected order and we will refund any amount paid for products not delivered.</p>

<h2>18. Privacy</h2>
<p>We use your personal data as described in our <a href="/policies/privacy">Privacy Policy</a>, which forms part of these Terms.</p>

<h2>19. Communications</h2>
<p>You agree that we may communicate with you electronically, including by email, SMS and notices on the website, and that such communications satisfy any legal requirement for communications to be in writing. Marketing messages are sent only where permitted, and you may unsubscribe at any time.</p>

<h2>20. Changes to these Terms and to the website</h2>
<p>We may update these Terms from time to time, for example to reflect changes in law or in how we operate. The version that applies to an order is the one published when you placed it. We may change, suspend or withdraw any part of the website at any time.</p>

<h2>21. General</h2>
<ul>
<li><strong>Entire agreement.</strong> These Terms, together with the policies referred to in them and your order confirmation, are the entire agreement between you and us about your order.</li>
<li><strong>Severability.</strong> If any provision is found to be invalid or unenforceable, the remaining provisions continue in full force.</li>
<li><strong>No waiver.</strong> If we delay or do not enforce any right, we do not waive it.</li>
<li><strong>Transfer.</strong> We may transfer our rights and obligations under these Terms to another organisation. You may not transfer yours without our written consent.</li>
<li><strong>Third parties.</strong> No one other than you and us has any right to enforce these Terms.</li>
<li><strong>Language.</strong> These Terms are made in English.</li>
</ul>

<h2>22. Governing law and disputes</h2>
<p>These Terms and any dispute or claim arising from them or from your use of the website are governed by the laws of Kenya. If you have a complaint, please contact us first so that we can try to resolve it; we aim to respond within 7 days. If a dispute cannot be resolved by negotiation within 30 days, either party may refer it to mediation in Nairobi. Failing settlement, the courts of Kenya have exclusive jurisdiction, without prejudice to your right as a consumer to bring proceedings in your local court or to complain to the relevant authority.</p>
`;

const privacy = `
<p><strong>Effective date: {{last_updated}}</strong></p>
<p>{{store_name}} ("<strong>we</strong>", "<strong>us</strong>") respects your privacy. This Privacy Policy explains how we collect, use, share and protect personal data when you use {{website}} or buy from us, and the rights you have. We process personal data in accordance with the Data Protection Act, 2019 and the Data Protection (General) Regulations, 2021 of Kenya.</p>

<h2>1. Who we are</h2>
<p>{{store_name}} is the data controller for the personal data described in this policy. {{contact_sentence}} For any privacy question or request, contact our data protection contact at {{store_email}}.</p>

<h2>2. Personal data we collect</h2>
<h3>Data you give us</h3>
<ul>
<li><strong>Account and identity:</strong> name, email address, phone number, password (stored only as a secure one-way hash) and, if you sign in with Google, the name, email and profile picture Google shares with us.</li>
<li><strong>Orders and delivery:</strong> delivery and billing addresses, order contents, delivery preferences, gift recipients' names and gift messages.</li>
<li><strong>Payments:</strong> payment method, amounts and transaction references (such as M-Pesa or bank references). Card numbers are collected and processed by our payment provider, Stripe, and never reach our systems.</li>
<li><strong>Communications:</strong> messages you send us, return and refund requests, reviews and newsletter sign-ups.</li>
</ul>
<h3>Data we collect automatically</h3>
<ul>
<li><strong>Security and device data:</strong> IP address, browser and device information, sign-in times and active sessions, used to protect accounts and prevent fraud.</li>
<li><strong>Usage data:</strong> pages and products viewed (counted in aggregate to show popular products) and items in your cart and wishlist.</li>
</ul>
<h3>Data from third parties</h3>
<p>Payment confirmations from Stripe and mobile money or bank providers, delivery updates from couriers, and sign-in information from Google if you choose to use it.</p>

<h2>3. Why we use your data, and our lawful basis</h2>
<ul>
<li><strong>To take, fulfil and deliver your orders, process returns and refunds, and provide customer service</strong>: performance of our contract with you.</li>
<li><strong>To take payments, prevent fraud and keep accounting and tax records</strong>: performance of the contract, compliance with legal obligations (including tax law) and our legitimate interest in preventing fraud.</li>
<li><strong>To secure your account and our systems</strong> (for example sign-in protection, lockouts, session limits and audit logs): our legitimate interests and legal obligations to keep data secure.</li>
<li><strong>To send service messages</strong> such as order confirmations, delivery updates and password resets: performance of the contract.</li>
<li><strong>To send marketing and newsletters</strong>: your consent, which you can withdraw at any time.</li>
<li><strong>To improve our website and range</strong> using aggregated and anonymised information: our legitimate interests.</li>
<li><strong>To comply with the law</strong>, respond to lawful requests from authorities and establish, exercise or defend legal claims: legal obligations and our legitimate interests.</li>
</ul>
<p>We do not make decisions about you based solely on automated processing that produce legal or similarly significant effects.</p>

<h2>4. Who we share your data with</h2>
<p>We share personal data only as needed, with:</p>
<ul>
<li><strong>Service providers</strong> acting on our instructions: payment processors (Stripe, mobile money and banking partners), couriers and delivery partners (your name, address and phone number), email and hosting providers, and IT support.</li>
<li><strong>Professional advisers</strong> such as auditors, accountants and lawyers.</li>
<li><strong>Authorities</strong> such as the Kenya Revenue Authority, law enforcement or courts, where the law requires it.</li>
<li><strong>A buyer or successor</strong> if our business, or part of it, is sold or reorganised, subject to equivalent protections.</li>
</ul>
<p>We require our service providers to protect your data and to use it only for the services they provide to us. <strong>We do not sell your personal data.</strong></p>

<h2>5. Transfers outside Kenya</h2>
<p>Some of our service providers (for example payment processing, email and cloud hosting) may store or process data outside Kenya. Where this happens, we transfer data only in accordance with the Data Protection Act, 2019, using appropriate safeguards such as contractual protections, or where the transfer is necessary for the performance of our contract with you.</p>

<h2>6. How long we keep your data</h2>
<ul>
<li><strong>Account data:</strong> for as long as your account is active, and deleted or anonymised within a reasonable period after you ask us to close it, unless we must keep it for the reasons below.</li>
<li><strong>Orders, invoices, payments and refunds:</strong> for at least five years after the transaction, or longer where tax or other laws require.</li>
<li><strong>Security logs:</strong> for as long as needed to protect accounts and investigate incidents, normally no longer than 24 months.</li>
<li><strong>Marketing preferences:</strong> until you unsubscribe, after which we keep a suppression record so that we do not contact you again.</li>
</ul>

<h2>7. How we protect your data</h2>
<p>We use appropriate technical and organisational measures, including encrypted connections, hashed passwords, role-based access for staff, recorded staff access to customer accounts, automatic sign-out of idle staff sessions and regular review of our systems. No method of transmission or storage is completely secure; if a personal data breach is likely to put your rights at risk, we will notify the Office of the Data Protection Commissioner and, where required, you, as the law requires.</p>

<h2>8. Your rights</h2>
<p>Under the Data Protection Act, 2019 you have the right to:</p>
<ul>
<li>be informed of how your personal data is used;</li>
<li>access the personal data we hold about you;</li>
<li>object to the processing of all or part of your personal data;</li>
<li>have inaccurate or misleading data corrected;</li>
<li>have false or misleading data deleted, and request erasure where we no longer have a lawful reason to keep it;</li>
<li>restrict processing in certain circumstances;</li>
<li>receive your data in a portable format; and</li>
<li>withdraw consent at any time, where we rely on it (this does not affect processing already carried out).</li>
</ul>
<p>Many details can be updated directly in your account. To exercise any other right, email {{store_email}}. We may need to verify your identity before acting on a request, and we respond within the time required by law. You also have the right to complain to the <strong>Office of the Data Protection Commissioner</strong> (www.odpc.go.ke), although we would appreciate the chance to address your concern first.</p>

<h2>9. Cookies and similar technologies</h2>
<p>We use a secure, essential cookie to keep you signed in, and your browser's local storage to remember your cart, wishlist and preferences such as currency. These are necessary for the website to work and do not track you across other websites. We do not use advertising or third-party tracking cookies. If we introduce non-essential cookies, we will ask for your consent first.</p>

<h2>10. Children</h2>
<p>Our website is not directed at children under 18, and we do not knowingly collect their personal data without the consent of a parent or guardian. If you believe a child has given us personal data, please contact us and we will delete it.</p>

<h2>11. Marketing</h2>
<p>We send marketing emails only if you have subscribed or otherwise agreed. Every marketing email includes a link to unsubscribe, and you can also contact us to stop receiving them. Service messages about your orders and account are not marketing and will still be sent.</p>

<h2>12. Changes to this policy</h2>
<p>We may update this Privacy Policy from time to time. The effective date at the top shows when it was last changed. Where changes are significant, we will tell you by email or on the website.</p>

<h2>13. Contact</h2>
<p>{{contact_sentence}} Please mark privacy matters "Data protection" so that they reach the right person quickly.</p>
`;

const refunds = `
<p><strong>Effective date: {{last_updated}}</strong></p>
<p>We want you to be happy with your order. This policy explains how to return items and how refunds work at {{store_name}}. It forms part of our <a href="/policies/terms">Terms and Conditions</a> and does not affect your statutory rights under the Consumer Protection Act, 2012 and other applicable law.</p>

<h2>1. Your right to return</h2>
<ul>
<li>You may ask to return an item within <strong>{{return_window_days}} days</strong> of delivery.</li>
<li>Items should be unused, in the same condition you received them, with all tags, accessories, manuals and original packaging where possible. Tell us if you have opened or used the item; it helps us assess it quickly.</li>
<li>Faulty items, items damaged in transit and items that are not what you ordered can always be returned, and you will not be charged for doing so.</li>
</ul>

<h2>2. Items that cannot be returned</h2>
<p>Unless they are faulty or not as described, we cannot accept returns of:</p>
<ul>
<li>items that have been personalised or made to your specifications;</li>
<li>perishable goods, or goods that deteriorate quickly;</li>
<li>items that cannot be returned for health or hygiene reasons once unsealed (for example cosmetics, skincare, earphones and underwear);</li>
<li>software, digital content or sealed media once unsealed;</li>
<li>gift cards and vouchers; and</li>
<li>items damaged through misuse, accident, wear and tear, or failure to follow care instructions after delivery.</li>
</ul>

<h2>3. How to return an item</h2>
<ol>
<li>Sign in, open <strong>Your orders</strong>, choose the delivered order and select <strong>Return</strong> next to the item. Tell us the reason and how many you are returning.</li>
<li>We review your request and let you know whether it is approved, usually within 2 business days. Please do not send items back before your return is approved.</li>
<li>Once approved, send or bring the item back as instructed, well packed, with your order number. You are responsible for the item until it reaches us, so use a trackable method for valuable items.</li>
<li>When the item arrives we inspect it. If it meets this policy, we refund you; if it does not, we will contact you and may return it to you.</li>
</ol>
<p>You can follow each step under <a href="/account/returns">Returns</a> in your account, and see the money paid back under <a href="/account/refunds">Refunds</a>.</p>

<h2>4. What we refund</h2>
<ul>
<li>The price you paid for the returned items, including any tax.</li>
<li>{{restocking_fee_sentence}}</li>
<li>{{delivery_refund_sentence}}</li>
<li>Gift box charges are refunded only if the gift box itself was faulty or not supplied.</li>
<li>Where you used a promotion (for example "buy one, get one" or a spend threshold), we may deduct the value of the discount that no longer applies.</li>
</ul>

<h2>5. How and when you are refunded</h2>
<ul>
<li>Refunds are made to the original payment method wherever possible. Card payments are refunded to the same card; your bank usually shows the money within 5 to 10 business days.</li>
<li>M-Pesa, bank transfer and cash payments are refunded by M-Pesa or bank transfer to the account you paid from or that you nominate.</li>
<li>We aim to pay refunds within 7 days of receiving and inspecting the item. Larger refunds may be checked by a manager before they are paid, which can take a little longer.</li>
<li>We will not refund to a different person or account without proof that you are entitled to the refund.</li>
</ul>

<h2>6. Faulty, damaged or wrong items</h2>
<p>If an item arrives damaged, develops a fault that is not caused by misuse, or is not what you ordered, please tell us within 48 hours of delivery for visible damage, or as soon as you discover a fault. Choose the matching reason when you request the return, and include photos if possible. We will repair, replace or refund the item, and cover the cost of returning it. For items covered by a manufacturer's warranty, we may refer you to the manufacturer after the return window has passed.</p>

<h2>7. Cancelling an order</h2>
<p>You can ask us to cancel an order at any time before it is dispatched, and we will refund any payment in full. Once an order has been dispatched, please refuse delivery or follow the returns process above.</p>

<h2>8. Exchanges</h2>
<p>We do not exchange items directly. Please return the item for a refund and place a new order for the item you want.</p>

<h2>9. Abuse of returns</h2>
<p>We may refuse a return or refund, or close an account, where we reasonably believe the returns process is being abused, for example through repeated returns of used items, returning items that were not bought from us, or fraudulent claims.</p>

<h2>10. Questions</h2>
<p>{{contact_sentence}} Please include your order number so that we can help quickly.</p>
`;

const about = `
<p><strong>{{store_name}}</strong> is an online shop that brings together everyday essentials, fresh tech and standout style, chosen with care and delivered to your door.</p>

<h2>What we stand for</h2>
<ul>
<li><strong>Products we would buy ourselves.</strong> We check what we sell, describe it honestly and show you the real price before you pay.</li>
<li><strong>Service that keeps its promises.</strong> We track every order from the moment you place it until it reaches you, against delivery targets we hold ourselves to.</li>
<li><strong>Payments you can trust.</strong> Pay by card through Stripe, by M-Pesa, by bank transfer or on delivery, whichever suits you.</li>
<li><strong>Easy returns.</strong> Changed your mind? You have {{return_window_days}} days from delivery to send most items back.</li>
</ul>

<h2>Your data, respected</h2>
<p>We collect only what we need to serve you, never sell your data, and keep it secure. Read our <a href="/policies/privacy">Privacy Policy</a> to see exactly how.</p>

<h2>Talk to us</h2>
<p>We would love to hear from you, whether it is a question about an order, feedback on a product or an idea for something we should stock. Visit our <a href="/support">Support</a> page or browse the <a href="/faq">FAQs</a>. {{contact_sentence}}</p>
`;

export const LEGAL_DEFAULTS: Record<'about' | 'terms' | 'privacy' | 'refunds', { title: string; body: string; updated: string }> = {
  about: { title: 'About us', body: about.trim(), updated: '2026-10-09' },
  terms: { title: 'Terms and Conditions', body: terms.trim(), updated: '2026-10-09' },
  privacy: { title: 'Privacy Policy', body: privacy.trim(), updated: '2026-10-09' },
  refunds: { title: 'Refund & Return Policy', body: refunds.trim(), updated: '2026-10-09' },
};
