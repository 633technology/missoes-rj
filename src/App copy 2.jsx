import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { MapPin, Users, Filter, Info, Navigation } from 'lucide-react';
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
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const selectedIbaIcon = new L.DivIcon({
  className: 'iba-marker selected',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
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
      <circle cx="15" cy="15" r="12" fill="#dc2626" stroke="white" stroke-width="3"/>
      <text x="15" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="bold">RJ</text>
    </svg>
  `),
  iconSize: [30, 30],
  iconAnchor: [15, 15],
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

  // Centro do Rio de Janeiro (Cristo Redentor)
  const rioCenter = [-22.9519, -43.2105];

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
  
  console.log('📊 Extraindo coordenadas do GeoJSON...');
  
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
        console.log('📍 Coordenada para', nome, ':', coord[1], coord[0]);
      }
    }
  });
  
  console.log('✅ Total de coordenadas extraídas:', coordinates.length);
  setBairroCoordinates(coordinates);
};

  // Função para centralizar no Rio
  const focusOnRio = () => {
    const map = document.querySelector('.leaflet-container')?._leaflet_id;
    if (map && L.DomUtil.get('map')) {
      const leafletMap = L.DomUtil.get('map')._leaflet;
      if (leafletMap) {
        leafletMap.setView(rioCenter, 12);
      }
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
    if (pop > 10000) return '#3b82f6'; // Azul para população > 10.000
    
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
  
  if (!bairro && nome) {
    console.log('Bairro não encontrado no CSV:', nome);
    console.log('Bairros disponíveis:', bairros.map(b => b.Bairro));
  }
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
      <div className="w-80 bg-card border-r border-border sidebar">
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa IBA Rio
          </h1>
          
          {/* Botão para centralizar no Rio */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Navigation className="h-4 w-4" />
                Navegação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="default"
                size="sm"
                onClick={focusOnRio}
                className="w-full"
              >
                <Navigation className="h-4 w-4 mr-2" />
                Centralizar no Rio
              </Button>
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
                  variant={showDistanceCircles ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDistanceCircles(!showDistanceCircles)}
                  className="w-full"
                >
                  Círculos 10km
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

          {/* Filtered Bairros */}
          {filteredBairros.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Bairros Filtrados ({filteredBairros.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {filteredBairros.slice(0, 20).map((bairro, index) => {
                    const hasHighPopulation = bairro.Populacao && bairro.Populacao !== 'nan' && parseInt(bairro.Populacao) > 50000;
                    
                    return (
                      <div key={index} className="text-xs p-2 bg-muted rounded">
                        <div className="font-medium">
                          {bairro.Bairro}
                          {hasHighPopulation && <span className="ml-2 bg-blue-500 text-white px-1 rounded">🟦</span>}
                        </div>
                        <div className="text-muted-foreground">
                          {bairro.RA} • {bairro.Populacao && bairro.Populacao !== 'nan' ? 
                            parseInt(bairro.Populacao).toLocaleString() + ' hab.' : 'Pop. N/A'}
                        </div>
                        {bairro.Distancia_Min_IBA_km && (
                          <div className="text-muted-foreground">
                            {parseFloat(bairro.Distancia_Min_IBA_km).toFixed(1)}km da IBA mais próxima
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredBairros.length > 20 && (
                    <div className="text-xs text-muted-foreground text-center p-2">
                      ... e mais {filteredBairros.length - 20} bairros
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 map-container">
        <MapContainer
          center={[-22.9068, -43.1729]}
          zoom={10}
          className="h-full w-full"
          id="map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* GeoJSON layer for bairros - DESTACADO */}
          {geoJsonData && (
            <GeoJSON
              key={showOnlyOutside10km ? 'geo-out' : 'geo-all'}
              //key={'geo-out'}
              data={geoJsonData}
              style={geoJsonStyle}
              filter={(feature) => {
                if (!showOnlyOutside10km) return true;
                const nome = getFeatName(feature);
                const bairro = bairros.find(b => norm(b.Bairro) === norm(nome));
                // return bairro ? isFalse(bairro.Dentro_10km_IBA) : false;
                return bairro;
              }}
              //filter={() => true}
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
            console.log('Processando bairro com população alta:', bairro.Bairro);

            const coord = bairroCoordinates.find(c => norm(c.nome) === norm(bairro.Bairro));
            console.log('Coordenada encontrada para', bairro.Bairro, ':', coord);

            if (!coord) {
              console.log('❌ Coordenada NÃO encontrada para:', bairro.Bairro);
              return null;
            }

            console.log('✅ Criando marcador para:', bairro.Bairro, 'em:', coord.lat, coord.lng);

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
                click: () => setSelectedIba(selectedIba === iba ? null : iba)
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
          {showDistanceCircles && ibas.map((iba, index) => (
            <Circle
              key={`circle-${index}`}
              center={[parseFloat(iba.Latitude), parseFloat(iba.Longitude)]}
              radius={10000} // 10km in meters
              pathOptions={{
                color: '#dc2626',
                fillColor: '#dc2626',
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '5, 5'
              }}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;