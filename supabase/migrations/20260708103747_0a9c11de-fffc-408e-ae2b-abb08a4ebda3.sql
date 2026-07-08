
UPDATE public.brand_profiles
SET
  industry = 'Natuurvriendelijke bijenhotels voor solitaire (wilde) bijen',
  audience = 'Tuinbezitters, natuurliefhebbers, bedrijven en overheden die biodiversiteit willen versterken in NL/BE',
  tone = 'Warm, deskundig, natuurgericht — kennis uit onderzoek, praktisch toepasbaar',
  pillars = ARRAY[
    'Wilde & solitaire bijen',
    'Bijenhotels & productmodellen (Chalet, Lodge, Penthouse, Studio, Tower)',
    'Biodiversiteit & bijvriendelijke tuinen',
    'Educatie & tips (plaatsen, onderhoud, cassettes)'
  ]::text[],
  usps = ARRAY[
    'Verwisselbare cassettes van onbehandeld beukenhout',
    'Gebaseerd op 40+ jaar onderzoek van Pieter van Breugel',
    'Duurzaam modulair ontwerp — Douglas hout of RVS',
    'Diepe, gladde nestgangen afgestemd op verschillende bijensoorten'
  ]::text[]
WHERE org_id = (SELECT id FROM public.organizations WHERE slug = 'happy-beez');
