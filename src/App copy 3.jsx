import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, GeoJSON, Polyline } from 'react-leaflet';
import L from 'leaflet';
import Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Slider } from './components/ui/slider';
import { Separator } from './components/ui/separator';
import { MapPin, Users, Filter, Info, Navigation, Ruler, CircleIcon, MousePointer } from 'lucide-react';
import './App.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom IBA marker icon
const ibaIcon = new L.DivIcon({
  className: 'iba-marker',
  html: '<div class="iba-marker-inner"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const selectedIbaIcon = new L.DivIcon({
  className: 'iba-marker selected',
  html: '<div class="iba-marker-inner"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Custom population marker icon
const populationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="8" fill="#3b82f6" stroke="white" stroke-width="2"/>
      <text x="10" y="14" text-anchor="middle" fill="white" font-size="10" font-weight="bold">P</text>
    </svg>
  `),
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Rio de Janeiro center marker icon
const rioCenterIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="15" r="12" fill="#f1d225ff" stroke="white" stroke-width="3"/>
      <text x="15" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="bold">RJ</text>
    </svg>
  `),
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Custom marker for distance measurement
const customMarkerIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0.5C5.6 0.5 0 6.1 0 13C0 22.8 12.5 40.5 12.5 40.5S25 22.8 25 13C25 6.1 19.4 0.5 12.5 0.5Z" fill="#10b981"/>
      <circle cx="12.5" cy="12.5" r="6.5" fill="white"/>
    </svg>
  `),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function App() {
  const [ibas, setIbas] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [selectedIba, setSelectedIba] = useState(null);
  const [showDistanceCircles, setShowDistanceCircles] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [showOnlyWithoutIba, setShowOnlyWithoutIba] = useState(false);
  const [showOnlyOutside10km, setShowOnlyOutside10km] = useState(false);
  const [showPopulationMarkers, setShowPopulationMarkers] = useState(true);
  const [showRioCenter, setShowRioCenter] = useState(true);
  const [bairroCoordinates, setBairroCoordinates] = useState([]);
  const [circleRadius, setCircleRadius] = useState(10); // in km
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState([]);
  const [distanceResult, setDistanceResult] = useState(null);
  const mapRef = useRef();

  // Centro do Rio de Janeiro (Cristo Redentor)
  const rioCenter = [-22.9035, -43.2096];

  useEffect(() => {
    // Load IBA data
    Papa.parse('src/assets/ibas_para_mapa.csv', {
      download: true,
      header: true,
      complete: (results) => {
        setIbas(results.data.filter(row => row.Name && row.Latitude && row.Longitude));
      }
    });

    // Load bairros data
    Papa.parse('src/assets/bairros_para_mapa.csv', {
      download: true,
      header: true,
      complete: (results) => {
        setBairros(results.data.filter(row => row.Bairro));
      }
    });

    // Load GeoJSON data
    fetch('src/assets/limites_bairros_rj.geojson')
      .then(response => response.json())
      .then(data => {
        setGeoJsonData(data);
        extractBairroCoordinates(data);
      })
      .catch(error => console.error('Error loading GeoJSON:', error));
  }, []);

  // Extrair coordenadas dos bairros do GeoJSON
  const extractBairroCoordinates = (geoData) => {
    const coordinates = [];
    
    geoData.features.forEach(feature => {
      if (feature.geometry && feature.geometry.coordinates) {
        const nome = feature.properties?.nome || feature.attributes?.nome;
        
        let coord = null;
        
        // Para polígonos, pegar o primeiro ponto
        if (feature.geometry.type === 'Polygon') {
          coord = feature.geometry.coordinates[0][0];
        }
        // Para multipolígonos, pegar o primeiro ponto do primeiro polígono
        else if (feature.geometry.type === 'MultiPolygon') {
          coord = feature.geometry.coordinates[0][0][0];
        }
        
        if (coord) {
          coordinates.push({
            nome: nome,
            lng: coord[0],
            lat: coord[1]
          });
        }
      }
    });
    
    setBairroCoordinates(coordinates);
  };

  // Função para centralizar no Rio
  const focusOnRio = () => {
    if (mapRef.current) {
      mapRef.current.setView(rioCenter, 12);
    }
  };

  // Função para calcular distância entre dois pontos em KM
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };

  // Handler para clique no mapa no modo medição
  const handleMapClick = (e) => {
    if (!measurementMode) return;
    
    const { lat, lng } = e.latlng;
    const newPoint = { lat, lng };
    
    if (measurementPoints.length === 0) {
      setMeasurementPoints([newPoint]);
    } else if (measurementPoints.length === 1) {
      const firstPoint = measurementPoints[0];
      const distance = calculateDistance(firstPoint.lat, firstPoint.lng, lat, lng);
      setDistanceResult(distance.toFixed(2) + ' km');
      setMeasurementPoints([...measurementPoints, newPoint]);
      
      // Auto-exit measurement mode after 3 seconds
      setTimeout(() => {
        setMeasurementMode(false);
        setMeasurementPoints([]);
        setDistanceResult(null);
      }, 3000);
    }
  };

  const filteredBairros = bairros.filter(bairro => {
    const matchesFilter = bairro.Bairro.toLowerCase().includes(filterText.toLowerCase()) ||
                         (bairro.RA && bairro.RA.toLowerCase().includes(filterText.toLowerCase()));
    
    const hasIba = bairro.Possui_IBA === 'True';
    const isOutside10km = bairro.Dentro_10km_IBA === 'False';
    
    if (showOnlyWithoutIba && hasIba) return false;
    if (showOnlyOutside10km && !isOutside10km) return false;
    
    return matchesFilter;
  });

  // Função auxiliar para normalizar nomes
  const norm = (str) => {
    if (!str) return '';
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ') // Remove espaços múltiplos
      .trim();
  };

  // Função auxiliar para verificar se é "False"
  const isFalse = (val) => val === 'False' || val === 'false';

  // Função para obter o nome da feature
  const getFeatName = (feature) => feature.attributes?.nome || feature.properties?.nome;

  const getPopulationColor = (populacao) => {
    if (!populacao || populacao === 'nan') return '#e5e7eb';
    const pop = parseInt(populacao);
    
    // Bairros com população acima de 10.000 recebem cor diferente
    if (pop > 50000) return '#3b82f6'; // Azul para população > 10.000
    
    return '#e5e7eb'; // Cinza para população <= 10.000 ou não disponível
  };

  // Estilo especial para o GeoJSON do Rio
  const geoJsonStyle = (feature) => {
    const nome = getFeatName(feature);
    const bairro = bairros.find(b => {
      // Tenta várias formas de matching
      const normalizedBairro = norm(b.Bairro);
      const normalizedNome = norm(nome);
      
      return normalizedBairro === normalizedNome || 
            normalizedBairro.includes(normalizedNome) ||
            normalizedNome.includes(normalizedBairro);
    });
    
    const populacao = bairro?.Populacao;
    
    return {
      fillColor: getPopulationColor(populacao),
      weight: 2,
      opacity: 1,
      color: '#1e40af',
      fillOpacity: 0.7,
      dashArray: '3'
    };
  };

  const onEachFeature = (feature, layer) => {
    const nome = getFeatName(feature);
    const bairro = bairros.find(b => norm(b.Bairro) === norm(nome));
    if (bairro) {
      const popupContent = `
        <div class="p-2">
          <h3 class="font-bold text-lg">${bairro.Bairro}</h3>
          <p><strong>Região:</strong> ${bairro.RA || 'N/A'}</p>
          <p><strong>População:</strong> ${bairro.Populacao && bairro.Populacao !== 'nan' ? parseInt(bairro.Populacao).toLocaleString() : 'Não disponível'}</p>
          <p><strong>Distância mínima da IBA:</strong> ${bairro.Distancia_Min_IBA_km ? parseFloat(bairro.Distancia_Min_IBA_km).toFixed(2) + ' km' : 'N/A'}</p>
          <p><strong>IBA mais próxima:</strong> ${bairro.IBA_Mais_Proxima || 'N/A'}</p>
          <p><strong>Possui IBA:</strong> ${bairro.Possui_IBA === 'True' ? 'Sim' : 'Não'}</p>
          <p><strong>Dentro de 10km de IBA:</strong> ${bairro.Dentro_10km_IBA === 'True' ? 'Sim' : 'Não'}</p>
        </div>
      `;
      layer.bindPopup(popupContent);
      
      // Destacar o bairro quando passar o mouse
      layer.on('mouseover', function() {
        layer.setStyle({
          weight: 4,
          color: '#dc2626', // Vermelho quando hover
          fillOpacity: 0.8
        });
      });
      
      layer.on('mouseout', function() {
        layer.setStyle(geoJsonStyle(feature));
      });
    }
  };

  // Obter bairros com população > 10.000
  const bairrosComPopulacaoAlta = bairros.filter(bairro => {
    return bairro.Populacao && bairro.Populacao !== 'nan' && parseInt(bairro.Populacao) > 50000;
  });

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 sidebar shadow-lg">
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-2 text-gray-800">
            <MapPin className="h-6 w-6 text-blue-600" />
            Mapa IBA Rio
          </h1>
          
          {/* Botão para centralizar no Rio */}
          <Card className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                <Navigation className="h-4 w-4" />
                Navegação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="default"
                size="sm"
                onClick={focusOnRio}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Navigation className="h-4 w-4 mr-2" />
                Centralizar no Rio
              </Button>
            </CardContent>
          </Card>

          {/* Configuração do Raio */}
          <Card className="mb-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                <CircleIcon className="h-4 w-4" />
                Configurar Raio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Raio do Círculo:</span>
                <Badge variant="secondary" className="bg-green-600">{circleRadius} km</Badge>
              </div>
              <Slider
                value={[circleRadius]}
                onValueChange={([value]) => setCircleRadius(value)}
                min={1}
                max={20}
                step={1}
                className="my-2"
              />
              <Button
                variant={showDistanceCircles ? "default" : "outline"}
                size="sm"
                onClick={() => setShowDistanceCircles(!showDistanceCircles)}
                className="w-full"
              >
                {showDistanceCircles ? 'Ocultar Círculos' : 'Mostrar Círculos'}
              </Button>
            </CardContent>
          </Card>

          {/* Medição de Distância */}
          <Card className="mb-4 bg-gradient-to-r from-purple-50 to-violet-50 border-purple-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
                <Ruler className="h-4 w-4" />
                Medição de Distância
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant={measurementMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMeasurementMode(!measurementMode);
                  setMeasurementPoints([]);
                  setDistanceResult(null);
                }}
                className="w-full"
              >
                <MousePointer className="h-4 w-4 mr-2" />
                {measurementMode ? 'Desativar Medição' : 'Ativar Medição'}
              </Button>
              
              {measurementMode && (
                <div className="text-xs text-purple-600 p-2 bg-purple-100 rounded">
                  Clique em dois pontos no mapa para medir a distância entre eles.
                </div>
              )}
              
              {distanceResult && (
                <div className="p-2 bg-green-100 text-green-800 rounded text-center font-bold">
                  Distância: {distanceResult}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filters */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Buscar bairro ou região..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="border-gray-300 focus:border-blue-500"
              />
              <div className="space-y-2">
                <Button
                  variant={showOnlyWithoutIba ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOnlyWithoutIba(!showOnlyWithoutIba)}
                  className="w-full"
                >
                  Sem IBA
                </Button>
                <Button
                  variant={showOnlyOutside10km ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOnlyOutside10km(!showOnlyOutside10km)}
                  className="w-full"
                >
                  Fora de 10km
                </Button>
                <Button
                  variant={showPopulationMarkers ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowPopulationMarkers(!showPopulationMarkers)}
                  className="w-full"
                >
                  {showPopulationMarkers ? 'Ocultar População >10k' : 'Mostrar População >10k'}
                </Button>
                <Button
                  variant={showRioCenter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowRioCenter(!showRioCenter)}
                  className="w-full"
                >
                  {showRioCenter ? 'Ocultar Centro RJ' : 'Mostrar Centro RJ'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                Estatísticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Total IBAs:</span>
                <Badge variant="secondary">{ibas.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Total Bairros:</span>
                <Badge variant="secondary">{bairros.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Sem IBA:</span>
                <Badge variant="destructive">
                  {bairros.filter(b => b.Possui_IBA === 'False').length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Fora de 10km:</span>
                <Badge variant="outline">
                  {bairros.filter(b => b.Dentro_10km_IBA === 'False').length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">População 10k:</span>
                <Badge variant="default" style={{backgroundColor: '#3b82f6'}}>
                  {bairrosComPopulacaoAlta.length}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* IBA List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                IBAs ({ibas.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {ibas.map((iba, index) => (
                  <Button
                    key={index}
                    variant={selectedIba === iba ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start text-left"
                    onClick={() => setSelectedIba(selectedIba === iba ? null : iba)}
                  >
                    <div className="truncate">
                      <div className="font-medium">{iba.Name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {iba.Bairro}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 map-container relative">
        <div className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded-lg shadow-md">
          {measurementMode && (
            <div className="text-sm font-semibold text-blue-600 flex items-center">
              <MousePointer className="h-4 w-4 mr-1" />
              Modo medição ativo - clique em dois pontos
            </div>
          )}
        </div>
        
        <MapContainer
          center={[-22.9068, -43.1729]}
          zoom={10}
          className="h-full w-full"
          ref={mapRef}
          onClick={handleMapClick}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* GeoJSON layer for bairros - DESTACADO */}
          {geoJsonData && (
            <GeoJSON
              key={showOnlyOutside10km ? 'geo-out' : 'geo-all'}
              data={geoJsonData}
              style={geoJsonStyle}
              filter={(feature) => {
                if (!showOnlyOutside10km) return true;
                const nome = getFeatName(feature);
                const bairro = bairros.find(b => norm(b.Bairro) === norm(nome));
                return bairro ? isFalse(bairro.Dentro_10km_IBA) : false;
              }}
              onEachFeature={onEachFeature}
            />
          )}

          {/* Marcador do centro do Rio de Janeiro */}
          {showRioCenter && (
            <Marker position={rioCenter} icon={rioCenterIcon}>
              <Popup>
                <div className="p-2 text-center">
                  <h3 className="font-bold text-lg">Rio de Janeiro</h3>
                  <p>Cidade Maravilhosa</p>
                  <p className="text-sm">Centro geográfico aproximado</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Population markers for bairros with > 10k population */}
          {/* {showPopulationMarkers && bairrosComPopulacaoAlta.map((bairro, index) => {
            const coord = bairroCoordinates.find(c => norm(c.nome) === norm(bairro.Bairro));
            if (!coord) return null;

            return (
              <Marker
                key={`pop-${index}`}
                position={[coord.lat, coord.lng]}
                icon={populationIcon}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold">{bairro.Bairro}</h3>
                    <p><strong>População:</strong> {parseInt(bairro.Populacao).toLocaleString()} habitantes</p>
                    <p><strong>Região:</strong> {bairro.RA || 'N/A'}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })} */}

          {/* IBA markers */}
          {ibas.map((iba, index) => (
            <Marker
              key={index}
              position={[parseFloat(iba.Latitude), parseFloat(iba.Longitude)]}
              icon={selectedIba === iba ? selectedIbaIcon : ibaIcon}
              eventHandlers={{
                click: () => {
                  setSelectedIba(selectedIba === iba ? null : iba);
                  // Se estiver no modo medição e já tiver um ponto, calcular distância
                  if (measurementMode && measurementPoints.length === 1) {
                    const firstPoint = measurementPoints[0];
                    const distance = calculateDistance(
                      firstPoint.lat, 
                      firstPoint.lng, 
                      parseFloat(iba.Latitude), 
                      parseFloat(iba.Longitude)
                    );
                    setDistanceResult(distance.toFixed(2) + ' km');
                    setMeasurementPoints([...measurementPoints, {
                      lat: parseFloat(iba.Latitude),
                      lng: parseFloat(iba.Longitude)
                    }]);
                    
                    // Auto-exit measurement mode after 3 seconds
                    setTimeout(() => {
                      setMeasurementMode(false);
                      setMeasurementPoints([]);
                      setDistanceResult(null);
                    }, 3000);
                  }
                }
              }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold">{iba.Name}</h3>
                  <p className="text-sm">{iba.Address}</p>
                  <p className="text-sm"><strong>Bairro:</strong> {iba.Bairro}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Distance circles */}
          {(showDistanceCircles || selectedIba) && ibas.map((iba, index) => {
            // Mostrar círculo apenas para IBA selecionada ou todas se showDistanceCircles estiver ativo
            if (showDistanceCircles || selectedIba === iba) {
              return (
                <Circle
                  key={`circle-${index}`}
                  center={[parseFloat(iba.Latitude), parseFloat(iba.Longitude)]}
                  radius={circleRadius * 1000} // Convert km to meters
                  pathOptions={{
                    color: selectedIba === iba ? '#10b981' : '#dc2626',
                    fillColor: selectedIba === iba ? '#10b981' : '#dc2626',
                    fillOpacity: 0.1,
                    weight: 2,
                    dashArray: '5, 5'
                  }}
                >
                  <Popup>
                    <div className="p-2 text-center">
                      <h3 className="font-bold">{iba.Name}</h3>
                      <p>Raio: {circleRadius} km</p>
                    </div>
                  </Popup>
                </Circle>
              );
            }
            return null;
          })}

          {/* Measurement points and line */}
          {measurementPoints.length > 0 && measurementPoints.map((point, index) => (
            <Marker
              key={`measure-${index}`}
              position={[point.lat, point.lng]}
              icon={customMarkerIcon}
            />
          ))}
          
          {measurementPoints.length === 2 && (
            <Polyline
              positions={measurementPoints}
              pathOptions={{ color: '#10b981', weight: 3 }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;