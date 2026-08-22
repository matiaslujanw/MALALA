/**
 * Mapeo del recuento físico de Yerba Buena al catálogo del sistema.
 *
 * Vive aparte porque lo usan dos scripts: el que carga el stock contado y el
 * que carga los precios de costo de la reventa. Con una copia en cada uno, al
 * corregir un mapeo en uno se olvidaría el otro y el stock terminaría en un
 * insumo y su costo en otro.
 */
/**
 * Mapeo del recuento al catálogo.
 *   - clave: como figura en el recuento ("Categoría :: Marca" en insumos, el
 *     nombre del producto en reventa).
 *   - valor: código del catálogo, o null si ese producto no está cargado.
 * Revisado por dos pasadas independientes; los null son a propósito.
 */
export const MAPEO: Record<string, string | null> = {
  // ---------- Insumos de bacha: tinturas ----------
  "Tintura :: L'Oréal Inoa": "INS117",
  "Tintura :: L'Oréal Majirel": "INS118",
  "Tintura :: L'Oréal Dia Color": "INS115",
  "Tintura :: L'Oréal Dia Light": "INS116",
  "Tintura :: Schwarzkopf Igora Royal": "INS310",
  "Tintura :: Schwarzkopf Highlifts": "INS309",
  "Tintura :: Question Professional": "INS207",
  "Tintura :: Question Professional Lumiplex Color": "INS206",
  // Absolutes y Fashion Lights NO se vuelcan a Igora Royal aunque sean del
  // mismo sistema: el catálogo ya distingue sublíneas de Igora (Highlifts tiene
  // entrada propia), así que la ausencia de estas dos es una ausencia real.
  // Cargarlas en Igora Royal inflaría el stock de un insumo que cotiza distinto
  // y ensuciaría el costo de todos los servicios de coloración.
  "Tintura :: Schwarzkopf Absolutes": null,
  "Tintura :: Schwarzkopf Fashion Lights": null,
  "Tintura :: Livesolut Color": null,

  // ---------- Oxidantes y decolorantes ----------
  // Ojo: el oxidante de una línea NO es la tintura de esa línea.
  "Oxidante :: L'Oréal Inoa Oil Developer": "INS106",
  "Oxidante :: L'Oréal Dia Activateur": "INS105",
  "Oxidante :: Schwarzkopf Igora Royal Oil Developer": "INS304",
  "Oxidante :: Question Professional Lumiplex Color": "INS203",
  "Oxidante :: Question Professional Crema Oxigenada": null,
  "Oxidante :: Question Professional Revelador Superaclarante": null,
  "Oxidante :: New Blond Crema Oxigenada": null,
  // El bidón de 5 L calza con el envase de INS839, pero ese insumo es el granel
  // sin marca que provee José: coincidir en el envase no prueba que sea el
  // mismo producto físico.
  "Oxidante (bidón genérico) :: Hairkadus Kadus Color": null,
  "Polvo decolorante :: SOW Pro-Plex": "INS708",
  "Polvo decolorante :: FarmaVita Suprema Color Blue": "INS707",

  // ---------- Ampollas y tratamientos ----------
  "Ampollas (Beauty Genesis Elixir Renovador, caja x12) :: Alfaparf Milano Semi di Lino Sublime":
    "INS002",
  "Ampollas (Ampolla Repair, caja x12) :: Exiline Cosméticos Biocell Repair": "INS601",
  "Ampollas (Ampolla Complex, caja x12) :: Biocell Therapy": null,
  // La revisión de la planilla dio de alta el insumo, así que ahora tiene dónde ir.
  "Ampollas/Tratamiento :: SOW Must Hair Elixir 21 (caja x10 ampollas)": "INS710",
  "Tratamiento (Restructuring Multiplier) :: Alfaparf Milano Semi di Lino Sublime": "INS003",
  "Shampoo :: Olaplex No.4P Blonde Enhancer Toning Shampoo": "INS504",
  "Aceite (Bonding Oil) :: Olaplex No.7": "INS503",
  "Shampoo Pre-Técnico (Alisado Luminoliss) :: Adriano Cosméticos Lumino Clean": null,

  // ---------- Productos de reventa ----------
  "Absolut Repair Shampoo 300ml": "VPC136",
  "Absolut Repair Acondicionador 200ml": "VPC137",
  "Absolut Repair Mascarilla": "VPC138",
  "Absolut Repair Oil 90ml": "VPC119",
  "Absolut Repair Molecular Shampoo 300ml": "VPC118",
  "Absolut Repair Molecular Mascarilla 250ml": "VPC117",
  "Absolut Repair Molecular Leave-in Mask 100ml": "VPC120",
  "Absolut Repair Molecular Sérum Rinse-off 250ml": null,
  "Absolut Repair Molecular Pre-Tratamiento Concentrado 190ml": null,
  "Vitamino Color Shampoo 300ml": "VPC128",
  "Vitamino Color Acondicionador 200ml": "VPC130",
  "Vitamino Color Mascarilla 250ml": "VPC131",
  "Vitamino Color Lait 10-en-1 190ml": "VPC129",
  "Vitamino Color Spectrum Serum 50ml": "VPC135",
  "Ultimate Repair Night Serum 30ml": "VPC103",
  "Ultimate Repair Miracle Hair Rescue 30ml": "VPC113",
  "Ultimate Smooth Mask 150ml": "VPC107",
  "Ultimate Smooth Miracle Oil Serum 30ml": "VPC108",
  "Maca Power Collagen Mascarilla 500ml": "VPC111",
  "Maca Power Essence Oil 50ml": "VPC124",
  "Twelve 12 Benef en 1 Tratamiento sin enjuague 210ml": "VPC112",
  "Silver Shampoo 200ml": "VPC114",
  "Keratin Lift Spray": "VPC127",
  "Q Style Termic Protect 240ml": "VPC126",
  "Pearl Suero Argán Perfeccionador de Brillo 30ml": "VPC122",
  "Biocell Repair Active Repair 300ml": "VPC140",
  "Biocell Repair Serum 100ml": "VPC141",
  "Biocell Repair Shampoo 300ml": "VPC139",
  "Bed Head Hair Stick 73g": "VPC100",
  "Bed Head After Party Smoothing Cream 50ml": "VPC115",
  "Bed Head Straighten Out Serum 100ml": "VPC116",
  "Small Talk Thickening Cream": "VPC101",
  "Keratin Alpha Sleek Máscara 250ml": null,
  "Keratin Alpha Sleek Shampoo 300ml": null,
  "Keratin Alpha Sleek Smooth Transformer 200ml": null,
  "Keratin Alpha Sleek Serum Discipline Miroir 50ml": null,
  "Lumière Óleo Tratante Capilar con Aceite de Argán": null,
  "Q Style Curl Cream 235ml": null,
  "Q Style Oil Molecular Flex 75ml": null,
  "Keratin Lift Óleo Tratante con Vitamina E y Aceite de Chía": null,
};

/** Motivo de los null: qué es el producto y por qué no está en el catálogo. */
export const SIN_CATALOGO: Record<string, string> = {
  "Tintura :: Livesolut Color": "marca que no figura en el catálogo",
  "Tintura :: Schwarzkopf Absolutes":
    "sublínea de Igora sin entrada propia; el catálogo sí separa Highlifts, así que falta de verdad",
  "Tintura :: Schwarzkopf Fashion Lights":
    "sublínea aclarante de Igora sin entrada propia (está más cerca de Highlifts que de Royal)",
  "Oxidante (bidón genérico) :: Hairkadus Kadus Color":
    "el bidón de 5 L del catálogo es el granel sin marca de José; coincide el envase pero no la marca",
  "Oxidante :: Question Professional Crema Oxigenada":
    "el catálogo sólo tiene el oxidante Lumiplex de Question",
  "Oxidante :: Question Professional Revelador Superaclarante": "no está en el catálogo",
  "Oxidante :: New Blond Crema Oxigenada": "marca que no figura en el catálogo",
  "Ampollas (Ampolla Complex, caja x12) :: Biocell Therapy":
    "el catálogo tiene una sola ampolla Exiline y ya la usa la Ampolla Repair",
  "Ampollas/Tratamiento :: SOW Must Hair Elixir 21 (caja x10 ampollas)":
    "marca que no figura en el catálogo",
  "Shampoo Pre-Técnico (Alisado Luminoliss) :: Adriano Cosméticos Lumino Clean":
    "el shampoo pre-técnico no es el alisado Luminoliss; son dos productos distintos",
  "Absolut Repair Molecular Sérum Rinse-off 250ml": "no está en el catálogo de reventa",
  "Absolut Repair Molecular Pre-Tratamiento Concentrado 190ml":
    "no está en el catálogo de reventa",
  "Keratin Alpha Sleek Máscara 250ml": "la línea Keratin Alpha Sleek se usa en bacha, no se vende",
  "Keratin Alpha Sleek Shampoo 300ml": "idem",
  "Keratin Alpha Sleek Smooth Transformer 200ml": "idem",
  "Keratin Alpha Sleek Serum Discipline Miroir 50ml": "idem",
  "Lumière Óleo Tratante Capilar con Aceite de Argán": "no está en el catálogo de reventa",
  "Q Style Curl Cream 235ml": "no está en el catálogo de reventa",
  "Q Style Oil Molecular Flex 75ml": "no está en el catálogo de reventa",
  "Keratin Lift Óleo Tratante con Vitamina E y Aceite de Chía":
    "el catálogo sólo tiene el spray Keratin Lift",
};
