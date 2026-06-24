const pptxgen = require("/tmp/node_modules/pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5

// Palette: HappyBeez — forest green + honey + cream
const FOREST = "2C5F2D";
const HONEY  = "E0A82E";
const CREAM  = "F7F1E3";
const INK    = "1F2A1F";
const MUTED  = "5B6B5B";

const FH = "Georgia";
const FB = "Calibri";

function bg(slide, color){
  slide.background = { color };
}
function footer(slide, n, total){
  slide.addShape("rect", { x:0, y:7.25, w:13.33, h:0.25, fill:{color:FOREST}, line:{color:FOREST} });
  slide.addText("HappyBeez · Social Studio", { x:0.5, y:7.27, w:7, h:0.22, fontFace:FB, fontSize:11, color:"FFFFFF" });
  slide.addText(`${n} / ${total}`, { x:11.83, y:7.27, w:1, h:0.22, fontFace:FB, fontSize:11, color:"FFFFFF", align:"right" });
}
function kicker(slide, text, color=HONEY){
  slide.addText(text, { x:0.6, y:0.55, w:8, h:0.4, fontFace:FB, fontSize:13, bold:true, color, charSpacing:4 });
}
function title(slide, text, color=INK){
  slide.addText(text, { x:0.6, y:0.95, w:12, h:1.4, fontFace:FH, fontSize:40, bold:true, color, lineSpacingMultiple:1.05 });
}

const TOTAL = 8;

// ---------- Slide 1: Cover ----------
{
  const s = p.addSlide(); bg(s, FOREST);
  s.addShape("ellipse", { x:-2, y:-2, w:6, h:6, fill:{color:HONEY}, line:{color:HONEY}, transparency:80 });
  s.addShape("ellipse", { x:9, y:4.5, w:6, h:6, fill:{color:CREAM}, line:{color:CREAM}, transparency:85 });
  s.addText("HAPPYBEEZ SOCIAL STUDIO", { x:0.8, y:1.4, w:12, h:0.5, fontFace:FB, fontSize:14, bold:true, color:HONEY, charSpacing:6 });
  s.addText("Eén plek voor je hele\nsocial marketing.", { x:0.8, y:2.0, w:12, h:2.6, fontFace:FH, fontSize:64, bold:true, color:"FFFFFF", lineSpacingMultiple:1.0 });
  s.addText("Waarom de kalender + slimme contentafwisseling de grootste tijd- en groeiwinst opleveren.", { x:0.8, y:5.0, w:11, h:1.0, fontFace:FB, fontSize:20, color:CREAM });
  footer(s, 1, TOTAL);
}

// ---------- Slide 2: The problem ----------
{
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "HET PROBLEEM");
  title(s, "Social media kost tijd. Vaak zonder resultaat.");
  const items = [
    ["Versnipperd", "Tools, tabs, losse notities. Niemand ziet het geheel."],
    ["Toevallig", "Je post wanneer je tijd hebt — niet wanneer het werkt."],
    ["Eenvormig", "Steeds dezelfde toon, dezelfde foto, hetzelfde kanaal."],
    ["Onzichtbaar", "Geen overzicht van wat werkt, wat niet en waarom."],
  ];
  let y = 2.6;
  for (const [h, t] of items){
    s.addShape("rect", { x:0.6, y, w:0.08, h:0.95, fill:{color:HONEY}, line:{color:HONEY} });
    s.addText(h, { x:0.85, y, w:3, h:0.4, fontFace:FH, fontSize:22, bold:true, color:INK });
    s.addText(t, { x:0.85, y:y+0.4, w:11.5, h:0.55, fontFace:FB, fontSize:18, color:MUTED });
    y += 1.05;
  }
  footer(s, 2, TOTAL);
}

// ---------- Slide 3: The solution ----------
{
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "DE OPLOSSING");
  title(s, "Eén werkruimte. Plan, schrijf, post — met richting.");
  // 3 columns
  const cols = [
    ["KALENDER", "Zie de hele maand. Weet vandaag al wat je vrijdag post.", FOREST],
    ["CONTENT STUDIO", "AI schrijft per kanaal. Direct met passende foto erbij.", HONEY],
    ["KENNISBANK", "Boek + foto's + nieuws als bron. Geen verzonnen feiten.", FOREST],
  ];
  cols.forEach((c, i) => {
    const x = 0.6 + i * 4.15;
    s.addShape("roundRect", { x, y:2.7, w:4.0, h:3.6, fill:{color:"FFFFFF"}, line:{color:"E5DCC3", width:1}, rectRadius:0.15 });
    s.addShape("rect", { x:x+0.4, y:3.0, w:0.6, h:0.08, fill:{color:c[2]}, line:{color:c[2]} });
    s.addText(c[0], { x:x+0.4, y:3.15, w:3.4, h:0.5, fontFace:FB, fontSize:13, bold:true, color:c[2], charSpacing:4 });
    s.addText(c[1], { x:x+0.4, y:3.75, w:3.2, h:2.0, fontFace:FH, fontSize:22, color:INK, lineSpacingMultiple:1.2 });
  });
  footer(s, 3, TOTAL);
}

// ---------- Slide 4: The calendar — hero ----------
{
  const s = p.addSlide(); bg(s, "FFFFFF");
  kicker(s, "WAAROM DE KALENDER WERKT", FOREST);
  title(s, "Van losse posts naar een ritme dat blijft hangen.");
  // Left: 4 reasons
  const reasons = [
    ["Vooruit denken", "Een maand vooruit zien voorkomt last-minute middelmaat."],
    ["Het juiste moment", "Posten op piekmomenten per kanaal — niet wanneer het uitkomt."],
    ["Mix bewaken", "Educatie, productverhaal, nieuws en seizoen — netjes verdeeld."],
    ["Eén klik publiceren", "Tekst en foto klaar. Open Instagram, plak, post."],
  ];
  let y = 2.55;
  reasons.forEach(([h,t]) => {
    s.addShape("ellipse", { x:0.65, y:y+0.05, w:0.35, h:0.35, fill:{color:HONEY}, line:{color:HONEY} });
    s.addText(h, { x:1.15, y, w:5.5, h:0.42, fontFace:FH, fontSize:20, bold:true, color:INK });
    s.addText(t, { x:1.15, y:y+0.42, w:5.5, h:0.55, fontFace:FB, fontSize:15, color:MUTED });
    y += 1.1;
  });
  // Right: mini calendar visual
  const cx = 7.2, cy = 2.55, cw = 5.6, ch = 4.0;
  s.addShape("roundRect", { x:cx, y:cy, w:cw, h:ch, fill:{color:CREAM}, line:{color:"E5DCC3", width:1}, rectRadius:0.15 });
  s.addText("JUNI", { x:cx+0.3, y:cy+0.2, w:5, h:0.3, fontFace:FB, fontSize:12, bold:true, color:FOREST, charSpacing:4 });
  const days = ["M","D","W","D","V","Z","Z"];
  days.forEach((d,i)=>{
    s.addText(d, { x:cx+0.3+i*0.74, y:cy+0.55, w:0.7, h:0.25, fontFace:FB, fontSize:10, bold:true, color:MUTED, align:"center" });
  });
  // 4 weeks x 7 — fill with a few colored dots
  const fill = {
    "0,0":HONEY,"0,3":FOREST,"0,5":HONEY,
    "1,1":FOREST,"1,4":HONEY,"1,6":FOREST,
    "2,0":HONEY,"2,2":FOREST,"2,5":HONEY,
    "3,1":FOREST,"3,3":HONEY,"3,4":FOREST,"3,6":HONEY,
  };
  for (let r=0;r<4;r++){
    for (let c=0;c<7;c++){
      const bx = cx+0.3+c*0.74, by = cy+0.9+r*0.7;
      s.addShape("roundRect", { x:bx, y:by, w:0.65, h:0.6, fill:{color:"FFFFFF"}, line:{color:"E5DCC3", width:1}, rectRadius:0.06 });
      const k = `${r},${c}`;
      if (fill[k]){
        s.addShape("ellipse", { x:bx+0.22, y:by+0.2, w:0.2, h:0.2, fill:{color:fill[k]}, line:{color:fill[k]} });
      }
    }
  }
  s.addShape("ellipse", { x:cx+0.3, y:cy+ch-0.5, w:0.18, h:0.18, fill:{color:HONEY}, line:{color:HONEY} });
  s.addText("educatie", { x:cx+0.55, y:cy+ch-0.58, w:1.5, h:0.3, fontFace:FB, fontSize:11, color:MUTED });
  s.addShape("ellipse", { x:cx+2.1, y:cy+ch-0.5, w:0.18, h:0.18, fill:{color:FOREST}, line:{color:FOREST} });
  s.addText("product", { x:cx+2.35, y:cy+ch-0.58, w:1.5, h:0.3, fontFace:FB, fontSize:11, color:MUTED });
  footer(s, 4, TOTAL);
}

// ---------- Slide 5: Content variety ----------
{
  const s = p.addSlide(); bg(s, CREAM);
  kicker(s, "AFWISSELING IS DE MOTOR");
  title(s, "Steeds dezelfde post? Algoritmes haken af. Mensen ook.");
  // 4 type cards
  const types = [
    ["Educatie","Korte feiten uit de kennisbank. Bouwt autoriteit.", FOREST],
    ["Productverhaal","Het bijenhotel in zijn context. Niet verkoperig.", HONEY],
    ["Actueel nieuws","Inhaken op echt bijennieuws van vandaag.", FOREST],
    ["Seizoen & tuin","Wat doet de wilde bij déze week? Praktisch advies.", HONEY],
  ];
  types.forEach((t,i)=>{
    const x = 0.6 + (i%4)*3.1;
    s.addShape("roundRect", { x, y:2.7, w:2.95, h:3.5, fill:{color:"FFFFFF"}, line:{color:"E5DCC3", width:1}, rectRadius:0.15 });
    s.addShape("rect", { x, y:2.7, w:2.95, h:0.18, fill:{color:t[2]}, line:{color:t[2]} });
    s.addText(t[0], { x:x+0.3, y:3.05, w:2.6, h:0.5, fontFace:FH, fontSize:22, bold:true, color:INK });
    s.addText(t[1], { x:x+0.3, y:3.65, w:2.5, h:2.2, fontFace:FB, fontSize:14, color:MUTED, lineSpacingMultiple:1.25 });
  });
  s.addText("De Studio kiest per kanaal de juiste toon — en pakt elke keer een andere relevante foto uit de bibliotheek of genereert er één.",
    { x:0.6, y:6.4, w:12.1, h:0.6, fontFace:FB, fontSize:14, italic:true, color:FOREST });
  footer(s, 5, TOTAL);
}

// ---------- Slide 6: Per kanaal ----------
{
  const s = p.addSlide(); bg(s, "FFFFFF");
  kicker(s, "ÉÉN ONDERWERP, VIER VERSIES", FOREST);
  title(s, "Instagram, Facebook, LinkedIn en blog — elk in eigen stem.");
  const ch = [
    ["Instagram", "Hook ≤12 woorden, max 150 woorden, save-waardig.", HONEY],
    ["Facebook", "Iets ruimer, persoonlijker, gericht op delen.", FOREST],
    ["LinkedIn", "Professioneel inzicht, 900–1400 tekens, discussie.", FOREST],
    ["Blog", "Lange-vorm met SEO-structuur en bronvermelding.", HONEY],
  ];
  ch.forEach((c,i)=>{
    const y = 2.55 + i*1.05;
    s.addShape("roundRect", { x:0.6, y, w:12.1, h:0.9, fill:{color:CREAM}, line:{color:"E5DCC3", width:1}, rectRadius:0.1 });
    s.addShape("rect", { x:0.6, y, w:0.18, h:0.9, fill:{color:c[2]}, line:{color:c[2]} });
    s.addText(c[0], { x:1.0, y:y+0.15, w:2.6, h:0.6, fontFace:FH, fontSize:22, bold:true, color:INK });
    s.addText(c[1], { x:3.7, y:y+0.2, w:8.9, h:0.55, fontFace:FB, fontSize:16, color:MUTED });
  });
  footer(s, 6, TOTAL);
}

// ---------- Slide 7: Marketing impact ----------
{
  const s = p.addSlide(); bg(s, FOREST);
  kicker(s, "WAAROM DIT MARKETING-MATIG TELT", HONEY);
  s.addText("Consistentie verslaat creativiteit.", { x:0.6, y:0.95, w:12, h:1.4, fontFace:FH, fontSize:40, bold:true, color:"FFFFFF" });
  const stats = [
    ["4x","kanalen vanuit één bron — zonder dubbel werk."],
    ["1 maand","vooruit gepland, in minder dan een uur per week."],
    ["0","verzonnen feiten — alles uit boek, nieuws of bibliotheek."],
  ];
  stats.forEach((st,i)=>{
    const x = 0.6 + i*4.2;
    s.addText(st[0], { x, y:2.8, w:4.0, h:1.6, fontFace:FH, fontSize:84, bold:true, color:HONEY });
    s.addText(st[1], { x, y:4.5, w:4.0, h:1.4, fontFace:FB, fontSize:16, color:CREAM, lineSpacingMultiple:1.3 });
  });
  s.addText("Resultaat: herkenbaar merk, betrouwbare expertise, en meer mensen die bij HappyBeez kopen omdat ze het verhaal kennen.",
    { x:0.6, y:6.1, w:12.1, h:1.0, fontFace:FB, fontSize:16, italic:true, color:"FFFFFF" });
  footer(s, 7, TOTAL);
}

// ---------- Slide 8: Closing ----------
{
  const s = p.addSlide(); bg(s, CREAM);
  s.addShape("ellipse", { x:10, y:-2, w:6, h:6, fill:{color:HONEY}, line:{color:HONEY}, transparency:75 });
  kicker(s, "SAMENGEVAT", FOREST);
  s.addText("Minder gedoe.\nMeer ritme. Meer bereik.", { x:0.6, y:1.2, w:12, h:2.6, fontFace:FH, fontSize:54, bold:true, color:INK, lineSpacingMultiple:1.05 });
  const points = [
    "Kalender geeft overzicht en het juiste moment.",
    "Slimme afwisseling houdt het publiek én het algoritme wakker.",
    "Eén bron van waarheid: boek, foto's, nieuws.",
    "Per kanaal de juiste toon — klaar om te plakken.",
  ];
  points.forEach((t,i)=>{
    const y = 4.2 + i*0.55;
    s.addShape("ellipse", { x:0.7, y:y+0.12, w:0.18, h:0.18, fill:{color:FOREST}, line:{color:FOREST} });
    s.addText(t, { x:1.0, y, w:11.5, h:0.45, fontFace:FB, fontSize:18, color:INK });
  });
  footer(s, 8, TOTAL);
}

p.writeFile({ fileName: "/mnt/documents/HappyBeez-Social-Studio.pptx" }).then(f => console.log("OK", f));
