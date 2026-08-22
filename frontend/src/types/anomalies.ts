/**
 * Proactive Marine Heatwave & Hypoxia Anomaly Alert Types
 * Directly maps to backend models in `src.api.routes`
 */

export interface AffectedSpeciesImpact {
  scientific_name: string;
  common_name: string;
  thermal_optimum?: string;
  impact: string;
}

export type AnomalySeverity = "MODERATE" | "STRONG" | "SEVERE" | "CRITICAL" | "EXTREME";
export type AnomalyAlertType = "MARINE_HEATWAVE" | "HYPOXIA" | "SALINITY_ANOMALY";
export type OceanBasin = "arabian_sea" | "bay_of_bengal" | "equatorial_io" | "gulf_of_mannar" | string;

export interface AnomalyAlert {
  id: number;
  alert_type: AnomalyAlertType;
  severity: AnomalySeverity;
  ocean_basin: OceanBasin;
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
  metric_name: string;
  current_value: number;
  baseline_value: number;
  anomaly_value: number;
  duration_days: number;
  affected_species: AffectedSpeciesImpact[];
  policy_advisory: string;
  created_at: string;
}

export interface MHWForecastRequest {
  ocean_basin: string;
  forecast_days: number;
}

export interface MHWForecastPoint {
  date: string;
  predicted_sst: number;
  climatological_baseline: number;
  anomaly: number;
}

export interface MHWForecastResponse {
  ocean_basin: string;
  forecast_horizon_days: number;
  predicted_mean_anomaly: number;
  mhw_declaration_probability: number;
  forecast_time_series: MHWForecastPoint[];
}

export interface ProfileQCRequest {
  platform_number: number;
  pressures: number[];
  temperatures: number[];
  salinities: number[];
}

export interface ProfileQCResponse {
  platform_number: number;
  is_anomalous: boolean;
  reconstruction_mse: number;
  detected_sensor_issue?: string | null;
  recommended_qc_flag: 1 | 2 | 3 | 4;
  status_message: string;
}
