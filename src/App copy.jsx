import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { MapPin, Users, Filter, Info } from 'lucide-react';
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

function App() {
  const [ibas, setIbas] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [selectedIba, setSelectedIba] = useState(null);
  const [showDistanceCircles, setShowDistanceCircles] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [showOnlyWithoutIba, setShowOnlyWithoutIba] = useState(false);
  const [showOnlyOutside10km, setShowOnlyOutside10km] = useState(false);

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
      .then(data => setGeoJsonData(data))
      .catch(error => console.error('Error loading GeoJSON:', error));
  }, []);

  const filteredBairros = bairros.filter(bairro => {
    const matchesFilter = bairro.Bairro.toLowerCase().includes(filterText.toLowerCase()) ||
                         (bairro.RA && bairro.RA.toLowerCase().includes(filterText.toLowerCase()));
    
    const hasIba = bairro.Possui_IBA === 'True';
    const isOutside10km = bairro.Dentro_10km_IBA === 'False';
    
    if (showOnlyWithoutIba && hasIba) return false;
    if (showOnlyOutside10km && !isOutside10km) return false;
    
    return matchesFilter;
  });

  const getPopulationColor = (populacao) => {
    if (!populacao || populacao === 'nan') return '#e5e7eb';
    const pop = parseInt(populacao);
    // if (pop > 200000 && pop >= 150001 ) return '#26dc6fff';
    if (pop > 150000) return '#ee3838ff';
    // if (pop > 100000) return '#d97706';
    // if (pop > 50000) return '#ca8a04';
    // return '#65a30d';
  };

  const geoJsonStyle = (feature) => {
    const bairro = bairros.find(b => b.Bairro === feature.attributes.nome);
    const populacao = bairro?.Populacao;
    
    return {
      fillColor: getPopulationColor(populacao),
      weight: 1,
      opacity: 0.8,
      color: '#374151',
      fillOpacity: 0.6
    };
  };

  const onEachFeature = (feature, layer) => {
    const bairro = bairros.find(b => b.Bairro === feature.attributes.nome);
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
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 bg-card border-r border-border sidebar">
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa IBA Rio
          </h1>
          
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
                  {filteredBairros.slice(0, 20).map((bairro, index) => (
                    <div key={index} className="text-xs p-2 bg-muted rounded">
                      <div className="font-medium">{bairro.Bairro}</div>
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
                  ))}
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
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* GeoJSON layer for bairros */}
        {geoJsonData && (
       
            <GeoJSON
              key={showOnlyOutside10km ? 'geo-out' : 'geo-all'} // força re-render ao alternar
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
