import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, GeoJSON, Polyline } from 'react-leaflet';
import L from 'leaflet';
import Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Slider } from './components/ui/slider';
import { Separator } from './components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Label } from './components/ui/label';
import { Switch } from './components/ui/switch';
import { MapPin, Users, Filter, Info, Navigation, Ruler, CircleIcon, MousePointer, Target, BarChart3 } from 'lucide-react';
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

// Função para calcular distância entre dois pontos em KM usando a fórmula de Haversine
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

// Função para normalizar nomes
const norm = (str) => {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

function App() {
  const [ibas, setIbas] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [selectedIba, setSelectedIba] = useState(null);
  const [showDistanceCircles, setShowDistanceCircles] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [showOnlyWithoutIba, setShowOnlyWithoutIba] = useState(false);
  const [showOnlyOutsideRadius, setShowOnlyOutsideRadius] = useState(false);
  const [showPopulationMarkers, setShowPopulationMarkers] = useState(true);
  const [showRioCenter, setShowRioCenter] = useState(true);
  const [bairroCoordinates, setBairroCoordinates] = useState([]);
  const [circleRadius, setCircleRadius] = useState(10); // in km
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState([]);
  const [distanceResult, setDistanceResult] = useState(null);
  const [minPopulation, setMinPopulation] = useState(0);
  const [maxPopulation, setMaxPopulation] = useState(500000);
  const [populationFilter, setPopulationFilter] = useState(10000);
  const mapRef = useRef();

  // Centro do Rio de Janeiro (Cristo Redentor)
  const rioCenter = [-22.9035, -43.2096];

  useEffect(() => {
    // Load IBA data
    Papa.parse('src/assets/ibas_para_mapa.csv', {
      download: true,
      header: true,
      complete: (results) => {
        const filteredIbas = results.data.filter(row => row.Name && row.Latitude && row.Longitude);
        setIbas(filteredIbas.map(iba => ({
          ...iba,
          Latitude: parseFloat(iba.Latitude),
          Longitude: parseFloat(iba.Longitude)
        })));
      }
    });

    // Load bairros data
    Papa.parse('src/assets/bairros_para_mapa.csv', {
      download: true,
      header: true,
      complete: (results) => {
        const filteredBairros = results.data.filter(row => row.Bairro);
        // Converter população para número
        const processedBairros = filteredBairros.map(bairro => ({
          ...bairro,
          Populacao: bairro.Populacao && bairro.Populacao !== 'nan' ? parseInt(bairro.Populacao) : 0
        }));
        
        setBairros(processedBairros);
        
        // Calcular população mínima e máxima para o filtro
        const populations = processedBairros.map(b => b.Populacao).filter(p => !isNaN(p));
        if (populations.length > 0) {
          setMinPopulation(Math.min(...populations));
          setMaxPopulation(Math.max(...populations));
          setPopulationFilter(Math.max(...populations) / 2); // Definir valor inicial como a média
        }
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

  // Calcular informações de IBA em tempo de execução
  const bairrosComCalculoIba = useMemo(() => {
    if (!ibas.length || !bairros.length) return bairros;
    
    return bairros.map(bairro => {
      const coord = bairroCoordinates.find(c => norm(c.nome) === norm(bairro.Bairro));
      if (!coord) return { ...bairro, Possui_IBA: false, Distancia_Min_IBA_km: null, IBA_Mais_Proxima: null };
      
      // Encontrar a IBA mais próxima
      let minDistance = Infinity;
      let nearestIba = null;
      
      ibas.forEach(iba => {
        const distance = calculateDistance(
          coord.lat, 
          coord.lng, 
          iba.Latitude, 
          iba.Longitude
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestIba = iba.Name;
        }
      });
      
      // Verificar se está dentro do raio configurado
      const dentroDoRaio = minDistance <= circleRadius;
      
      return {
        ...bairro,
        Possui_IBA: minDistance < 0.5, // Considera que tem IBA se estiver a menos de 500m
        Distancia_Min_IBA_km: minDistance,
        IBA_Mais_Proxima: nearestIba,
        Dentro_raio_IBA: dentroDoRaio
      };
    });
  }, [ibas, bairros, bairroCoordinates, circleRadius]);

  // Função para centralizar no Rio
  const focusOnRio = () => {
    if (mapRef.current) {
      mapRef.current.setView(rioCenter, 12);
    }
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

  // Filtrar bairros com base nos critérios selecionados
  const filteredBairros = useMemo(() => {
    return bairrosComCalculoIba.filter(bairro => {
      const matchesFilter = bairro.Bairro.toLowerCase().includes(filterText.toLowerCase()) ||
                           (bairro.RA && bairro.RA.toLowerCase().includes(filterText.toLowerCase()));
      
      const matchesPopulation = bairro.Populacao >= populationFilter;
      
      if (showOnlyWithoutIba && bairro.Possui_IBA) return false;
      if (showOnlyOutsideRadius && bairro.Dentro_raio_IBA) return false;
      
      return matchesFilter && matchesPopulation;
    });
  }, [bairrosComCalculoIba, filterText, showOnlyWithoutIba, showOnlyOutsideRadius, populationFilter]);

  // Obter bairros com população acima do filtro
  const bairrosComPopulacaoAlta = useMemo(() => {
    return bairrosComCalculoIba.filter(bairro => bairro.Populacao >= populationFilter);
  }, [bairrosComCalculoIba, populationFilter]);

  // Estatísticas calculadas em tempo real
  const stats = useMemo(() => {
    const totalBairros = bairrosComCalculoIba.length;
    const bairrosSemIba = bairrosComCalculoIba.filter(b => !b.Possui_IBA).length;
    const bairrosForaDoRaio = bairrosComCalculoIba.filter(b => !b.Dentro_raio_IBA).length;
    const bairrosComPopulacao = bairrosComPopulacaoAlta.length;
    
    return {
      totalBairros,
      bairrosSemIba,
      bairrosForaDoRaio,
      bairrosComPopulacao
    };
  }, [bairrosComCalculoIba, bairrosComPopulacaoAlta]);

  // Estilo especial para o GeoJSON do Rio
  const geoJsonStyle = (feature) => {
    const nome = getFeatName(feature);
    const bairro = bairrosComCalculoIba.find(b => norm(b.Bairro) === norm(nome));
    
    const getPopulationColor = (populacao) => {
      if (!populacao) return '#e5e7eb';
      
      // Escala de cores baseada na população
      if (populacao > 100000) return '#3b82f6'; // Azul para população alta
      if (populacao > 50000) return '#60a5fa'; // Azul médio
      if (populacao > 10000) return '#93c5fd'; // Azul claro
      
      return '#e5e7eb'; // Cinza para população baixa
    };
    
    return {
      fillColor: getPopulationColor(bairro?.Populacao),
      weight: 2,
      opacity: 1,
      color: '#1e40af',
      fillOpacity: 0.7,
      dashArray: '3'
    };
  };

  const getFeatName = (feature) => feature.attributes?.nome || feature.properties?.nome;

  const onEachFeature = (feature, layer) => {
    const nome = getFeatName(feature);
    const bairro = bairrosComCalculoIba.find(b => norm(b.Bairro) === norm(nome));
    
    if (bairro) {
      const popupContent = `
        <div class="p-2">
          <h3 class="font-bold text-lg">${bairro.Bairro}</h3>
          <p><strong>Região:</strong> ${bairro.RA || 'N/A'}</p>
          <p><strong>População:</strong> ${bairro.Populacao ? bairro.Populacao.toLocaleString() : 'Não disponível'}</p>
          <p><strong>Distância mínima da IBA:</strong> ${bairro.Distancia_Min_IBA_km ? bairro.Distancia_Min_IBA_km.toFixed(2) + ' km' : 'N/A'}</p>
          <p><strong>IBA mais próxima:</strong> ${bairro.IBA_Mais_Proxima || 'N/A'}</p>
          <p><strong>Possui IBA:</strong> ${bairro.Possui_IBA ? 'Sim' : 'Não'}</p>
          <p><strong>Dentro de ${circleRadius}km de IBA:</strong> ${bairro.Dentro_raio_IBA ? 'Sim' : 'Não'}</p>
        </div>
      `;
      layer.bindPopup(popupContent);
      
      // Destacar o bairro quando passar o mouse
      layer.on('mouseover', function() {
        layer.setStyle({
          weight: 4,
          color: '#dc2626',
          fillOpacity: 0.8
        });
      });
      
      layer.on('mouseout', function() {
        layer.setStyle(geoJsonStyle(feature));
      });
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-96 bg-white border-r border-gray-200 sidebar shadow-lg overflow-y-auto">
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
                Configurar Raio de Cobertura
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

          {/* Filtro de População */}
          <Card className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                <Users className="h-4 w-4" />
                Filtro de População
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">População mínima:</span>
                <Badge variant="secondary" className="bg-amber-600">{populationFilter.toLocaleString()} hab.</Badge>
              </div>
              <Slider
                value={[populationFilter]}
                onValueChange={([value]) => setPopulationFilter(value)}
                min={minPopulation}
                max={maxPopulation}
                step={1000}
                className="my-2"
              />
              <div className="text-xs text-amber-600">
                Mostrando bairros com {populationFilter.toLocaleString()} habitantes ou mais
              </div>
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
              
              <div className="flex items-center justify-between">
                <Label htmlFor="without-iba" className="text-sm">Sem IBA</Label>
                <Switch
                  id="without-iba"
                  checked={showOnlyWithoutIba}
                  onCheckedChange={setShowOnlyWithoutIba}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="outside-radius" className="text-sm">Fora do raio de {circleRadius}km</Label>
                <Switch
                  id="outside-radius"
                  checked={showOnlyOutsideRadius}
                  onCheckedChange={setShowOnlyOutsideRadius}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="population-markers" className="text-sm">Marcadores de população</Label>
                <Switch
                  id="population-markers"
                  checked={showPopulationMarkers}
                  onCheckedChange={setShowPopulationMarkers}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="rio-center" className="text-sm">Centro do Rio</Label>
                <Switch
                  id="rio-center"
                  checked={showRioCenter}
                  onCheckedChange={setShowRioCenter}
                />
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Estatísticas em Tempo Real
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Total IBAs:</span>
                <Badge variant="secondary">{ibas.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Total Bairros:</span>
                <Badge variant="secondary">{stats.totalBairros}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Sem IBA:</span>
                <Badge variant="destructive">{stats.bairrosSemIba}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Fora do raio:</span>
                <Badge variant="outline">{stats.bairrosForaDoRaio}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">População ≥ {populationFilter.toLocaleString()}:</span>
                <Badge variant="default" style={{backgroundColor: '#3b82f6'}}>
                  {stats.bairrosComPopulacao}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Bairros fora do raio */}
          {showOnlyOutsideRadius && (
            <Card className="mb-4 bg-gradient-to-r from-red-50 to-rose-50 border-red-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                  <Target className="h-4 w-4" />
                  Bairros Fora do Raio ({stats.bairrosForaDoRaio})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {bairrosComCalculoIba
                    .filter(b => !b.Dentro_raio_IBA)
                    .sort((a, b) => b.Populacao - a.Populacao)
                    .map((bairro, index) => (
                      <div key={index} className="text-sm p-2 bg-white rounded border">
                        <div className="font-medium">{bairro.Bairro}</div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{bairro.Populacao.toLocaleString()} hab.</span>
                          <span>{bairro.Distancia_Min_IBA_km?.toFixed(2)} km da IBA mais próxima</span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          )}

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
          
          {/* GeoJSON layer for bairros */}
          {geoJsonData && (
            <GeoJSON
              key={`geo-${showOnlyOutsideRadius}-${circleRadius}`}
              data={geoJsonData}
              style={geoJsonStyle}
              filter={(feature) => {
                if (!showOnlyOutsideRadius) return true;
                const nome = getFeatName(feature);
                const bairro = bairrosComCalculoIba.find(b => norm(b.Bairro) === norm(nome));
                return bairro ? !bairro.Dentro_raio_IBA : false;
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

          {/* Population markers for bairros with high population */}
          {showPopulationMarkers && bairrosComPopulacaoAlta.map((bairro, index) => {
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
                    <p><strong>População:</strong> {bairro.Populacao.toLocaleString()} habitantes</p>
                    <p><strong>Região:</strong> {bairro.RA || 'N/A'}</p>
                    <p><strong>Distância da IBA mais próxima:</strong> {bairro.Distancia_Min_IBA_km?.toFixed(2)} km</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* IBA markers */}
          {ibas.map((iba, index) => (
            <Marker
              key={index}
              position={[iba.Latitude, iba.Longitude]}
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
                      iba.Latitude, 
                      iba.Longitude
                    );
                    setDistanceResult(distance.toFixed(2) + ' km');
                    setMeasurementPoints([...measurementPoints, {
                      lat: iba.Latitude,
                      lng: iba.Longitude
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
                  center={[iba.Latitude, iba.Longitude]}
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