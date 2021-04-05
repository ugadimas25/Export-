// 08 EXPORTS

// SUPERVISED CLASSIFICATION - Geometry Imports
// Buat sampel kelas 'urban', 'vegetation', dan 'water' dalam point
// Buat region dalam polygon

// Muat Landsat 8 surface reflectance data
var l8sr = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR');

// Fungsi untuk cloud mask dari band Fmask data Landsat 8 SR.
function maskL8sr(image) {
    // Bit 3 dan 5 masing-masing adalah cloud shadow dan cloud.
    var cloudShadowBitMask = ee.Number(2).pow(3).int();
    var cloudsBitMask = ee.Number(2).pow(5).int();

    // Dapatkan band pixel QA.
    var qa = image.select('pixel_qa');

    // Kedua 'flag' harus diatur ke 'nol', yang menunjukkan kondisi yang jelas.
    var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
        .and(qa.bitwiseAnd(cloudsBitMask).eq(0));

    // Kembalikan nilai citra yang di-mask, diskalakan ke [0, 1].
    return image.updateMask(mask).divide(10000);
}

// Memetakan fungsi lebih dari satu tahun data dan mengambil median.
var image = l8sr.filterDate('2016-01-01', '2016-12-31')
    .map(maskL8sr)
    .median();

// Tampilkan hasilnya.
Map.addLayer(image, { bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3 }, 'image');

var newfc = urban.merge(vegetation).merge(water);
//print(newfc);
//Map.centerObject(newfc,11);
Map.centerObject(region, 11);

var bands = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7'];

var training = image.select(bands).sampleRegions({
    collection: newfc,
    properties: ['landcover'],
    scale: 30
});
// Print(training)

var classifier = ee.Classifier.smileCart().train({
    features: training,
    classProperty: 'landcover',
    inputProperties: bands
});
print(classifier.explain());

var classified = image.select(bands).classify(classifier);
//Map.addLayer(classified, {min: 0, max: 2, palette: ['red', 'green', 'blue']}, 'CART');

// Clip dengan region
var clipimage = classified.clip(region);
print(clipimage);

Map.addLayer(clipimage, { min: 0, max: 2, palette: ['red', 'green', 'blue'] }, 'clipcart');


// RASTER TO VECTOR
// Convert clipimage to vectors.
var vectors = clipimage.addBands(classified).reduceToVectors({
    geometry: region,
    crs: classified.projection(),
    scale: 30,
    geometryType: 'polygon',
    eightConnected: true,
    labelProperty: 'zone',
    reducer: ee.Reducer.mean()
});

// EXPORT to SHP
// Make a display image for the vectors, add it to the map.
var display = ee.Image(0).updateMask(0).paint(vectors, 'black', 1);
Map.addLayer(display, { palette: 'black' }, 'vectors');

// Export the FeatureCollection to a SHP file.
Export.table.toDrive({
    collection: vectors,
    description: 'L8_landcover',
    fileFormat: 'SHP'
});