import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Vulnerability } from '../types';
import { ErrorLogger } from './errorLogger';

// NVD API Configuration - API key should be set via environment variable
const NVD_API_KEY = import.meta.env.VITE_NVD_API_KEY || '';
const NVD_API_BASE_URL = 'https://services.nvd.nist.gov/rest/json';
const NVD_API_DELAY = 6; // seconds between requests (required without API key)
const NVD_API_RESULTS_PER_PAGE = 2000;

interface NVDVulnerability {
  cve: {
    id: string;
    sourceIdentifier: string;
    published: string;
    lastModified: string;
    vulnStatus: string;
    descriptions: Array<{
      lang: string;
      value: string;
    }>;
    metrics?: {
      cvssMetricV31?: Array<{
        cvssData: {
          version: string;
          vectorString: string;
          attackVector: string;
          attackComplexity: string;
          privilegesRequired: string;
          userInteraction: string;
          scope: string;
          confidentialityImpact: string;
          integrityImpact: string;
          availabilityImpact: string;
          baseScore: number;
          baseSeverity: string;
        };
        exploitabilityScore: number;
        impactScore: number;
      }>;
      cvssMetricV30?: Array<{
        cvssData: {
          version: string;
          vectorString: string;
          attackVector: string;
          attackComplexity: string;
          privilegesRequired: string;
          userInteraction: string;
          scope: string;
          confidentialityImpact: string;
          integrityImpact: string;
          availabilityImpact: string;
          baseScore: number;
          baseSeverity: string;
        };
        exploitabilityScore: number;
        impactScore: number;
      }>;
      cvssMetricV2?: Array<{
        cvssData: {
          version: string;
          vectorString: string;
          accessVector: string;
          accessComplexity: string;
          authentication: string;
          confidentialityImpact: string;
          integrityImpact: string;
          availabilityImpact: string;
          baseScore: number;
          severity: string;
        };
        exploitabilityScore: number;
        impactScore: number;
        acInsufInfo: boolean;
        obtainAllPrivilege: boolean;
        obtainUserPrivilege: boolean;
        obtainOtherPrivilege: boolean;
        userInteractionRequired: boolean;
      }>;
    };
    weaknesses?: Array<{
      source: string;
      type: string;
      description: Array<{
        lang: string;
        value: string;
      }>;
    }>;
    configurations?: {
      nodes: Array<{
        operator: string;
        negate: boolean;
        cpeMatch?: Array<{
          vulnerable: boolean;
          criteria: string;
          matchCriteriaId: string;
        }>;
      }>;
    };
    references?: Array<{
      url: string;
      source: string;
      tags?: string[];
    }>;
  };
}

interface NVDResponse {
  vulnerabilitiesPerPage: number;
  startIndex: number;
  totalResults: number;
  vulnerabilities: NVDVulnerability[];
}

export class NVDService {
  private static lastRequestTime = 0;

  /**
   * Rate limiting helper to respect NVD API limits
   */
  private static async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = (now - this.lastRequestTime) / 1000;
    
    if (timeSinceLastRequest < NVD_API_DELAY) {
      const waitTime = (NVD_API_DELAY - timeSinceLastRequest) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Helper to get severity from CVSS score
   */
  private static getSeverityFromScore(score: number): 'Critical' | 'High' | 'Medium' | 'Low' {
    if (score >= 9.0) return 'Critical';
    if (score >= 7.0) return 'High';
    if (score >= 4.0) return 'Medium';
    return 'Low';
  }

  /**
   * Extract CVSS metrics from NVD vulnerability
   */
  private static extractCVSSMetrics(nvdVuln: NVDVulnerability): { score: number; severity: string; vector: string } | null {
    const metrics = nvdVuln.cve.metrics;
    
    // Try CVSS v3.1 first
    if (metrics?.cvssMetricV31?.length) {
      const cvss = metrics.cvssMetricV31[0].cvssData;
      return {
        score: cvss.baseScore,
        severity: cvss.baseSeverity,
        vector: cvss.vectorString
      };
    }
    
    // Then CVSS v3.0
    if (metrics?.cvssMetricV30?.length) {
      const cvss = metrics.cvssMetricV30[0].cvssData;
      return {
        score: cvss.baseScore,
        severity: cvss.baseSeverity,
        vector: cvss.vectorString
      };
    }
    
    // Finally CVSS v2
    if (metrics?.cvssMetricV2?.length) {
      const cvss = metrics.cvssMetricV2[0].cvssData;
      return {
        score: cvss.baseScore,
        severity: this.getSeverityFromScore(cvss.baseScore),
        vector: cvss.vectorString
      };
    }
    
    return null;
  }

  /**
   * Convert NVD vulnerability to Sentinel vulnerability format
   */
  private static convertToSentinelVulnerability(nvdVuln: NVDVulnerability, organizationId: string): Partial<Vulnerability> {
    const cve = nvdVuln.cve;
    const cvssMetrics = this.extractCVSSMetrics(nvdVuln);
    
    // Get English description
    const description = cve.descriptions.find(desc => desc.lang === 'en')?.value || 
                       cve.descriptions[0]?.value || 
                       'No description available';

    return {
      cveId: cve.id,
      title: `${cve.id}: ${description.split('.')[0].substring(0, 100)}...`,
      description: description,
      severity: (cvssMetrics?.severity as 'Critical' | 'High' | 'Medium' | 'Low') || 'Medium',
      score: cvssMetrics?.score,
      cvssVector: cvssMetrics?.vector,
      status: 'Open',
      source: 'NVD',
      publishedDate: cve.published,
      detectedAt: new Date().toISOString(),
      organizationId: organizationId
    };
  }

  
  /**
   * Fetch vulnerabilities from NVD API
   */
  public static async fetchVulnerabilities(params: {
    keyword?: string;
    cveId?: string;
    cvssScore?: number;
    startDate?: string;
    endDate?: string;
    resultsPerPage?: number;
    startIndex?: number;
  } = {}): Promise<NVDResponse> {
    try {
      await this.waitForRateLimit();
      
      const searchParams = new URLSearchParams();
      
      if (params.keyword) searchParams.append('keywordSearch', params.keyword);
      if (params.cveId) searchParams.append('cveId', params.cveId);
      if (params.cvssScore) searchParams.append('cvssV3Severity', params.cvssScore >= 9 ? 'CRITICAL' : params.cvssScore >= 7 ? 'HIGH' : params.cvssScore >= 4 ? 'MEDIUM' : 'LOW');
      if (params.startDate) searchParams.append('pubStartDate', params.startDate);
      if (params.endDate) searchParams.append('pubEndDate', params.endDate);
      
      searchParams.append('resultsPerPage', (params.resultsPerPage || NVD_API_RESULTS_PER_PAGE).toString());
      searchParams.append('startIndex', (params.startIndex || 0).toString());
      
      const url = `${NVD_API_BASE_URL}/cves/2.0?${searchParams.toString()}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (NVD_API_KEY) {
        headers['apiKey'] = NVD_API_KEY;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });
      
      if (!response.ok) {
        throw new Error(`NVD API error: ${response.status} ${response.statusText}`);
      }
      
      const data: NVDResponse = await response.json();
      return data;
      
    } catch (error) {
      ErrorLogger.error(error as Error, 'NVDService.fetchVulnerabilities');
      throw error;
    }
  }

  /**
   * Import NVD vulnerabilities into Sentinel
   */
  public static async importVulnerabilities(
    organizationId: string,
    params: {
      keyword?: string;
      cveId?: string;
      cvssScore?: number;
      startDate?: string;
      endDate?: string;
      limit?: number;
    } = {}
  ): Promise<{ imported: number; total: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    let total = 0;
    
    try {
      const vulnerabilitiesRef = collection(db, 'organizations', organizationId, 'vulnerabilities');
      
      // Fetch vulnerabilities from NVD
      const nvdResponse = await this.fetchVulnerabilities({
        keyword: params.keyword,
        cveId: params.cveId,
        cvssScore: params.cvssScore,
        startDate: params.startDate,
        endDate: params.endDate,
        resultsPerPage: params.limit || NVD_API_RESULTS_PER_PAGE
      });
      
      total = nvdResponse.totalResults;
      
      // Convert and import each vulnerability
      for (const nvdVuln of nvdResponse.vulnerabilities) {
        try {
          const sentinelVuln = this.convertToSentinelVulnerability(nvdVuln, organizationId);
          
          await addDoc(vulnerabilitiesRef, {
            ...sentinelVuln,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          imported++;
        } catch (error) {
          errors.push(`Failed to import ${nvdVuln.cve.id}: ${(error as Error).message}`);
          ErrorLogger.error(error as Error, 'NVDService.importVulnerabilities');
        }
      }
      
      return { imported, total, errors };
      
    } catch (error) {
      ErrorLogger.error(error as Error, 'NVDService.importVulnerabilities');
      throw error;
    }
  }

  /**
   * Get vulnerability details by CVE ID
   */
  public static async getVulnerabilityDetails(cveId: string): Promise<NVDVulnerability | null> {
    try {
      const response = await this.fetchVulnerabilities({ cveId });
      
      if (response.vulnerabilities.length > 0) {
        return response.vulnerabilities[0];
      }
      
      return null;
    } catch (error) {
      ErrorLogger.error(error as Error, 'NVDService.getVulnerabilityDetails');
      throw error;
    }
  }

  /**
   * Search vulnerabilities by keyword
   */
  public static async searchVulnerabilities(
    keyword: string,
    organizationId: string,
    options: {
      limit?: number;
      severity?: 'Critical' | 'High' | 'Medium' | 'Low';
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{ imported: number; total: number; errors: string[] }> {
    return this.importVulnerabilities(organizationId, {
      keyword,
      cvssScore: options.severity ? 
        options.severity === 'Critical' ? 9 :
        options.severity === 'High' ? 7 :
        options.severity === 'Medium' ? 4 : 1 : undefined,
      startDate: options.startDate,
      endDate: options.endDate,
      limit: options.limit
    });
  }

  /**
   * Get recent vulnerabilities (last 7 days by default)
   */
  public static async getRecentVulnerabilities(
    organizationId: string,
    days: number = 7
  ): Promise<{ imported: number; total: number; errors: string[] }> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return this.importVulnerabilities(organizationId, {
      startDate,
      endDate,
      limit: 100 // Limit recent imports to prevent overwhelming
    });
  }

  /**
   * Test NVD API connection
   */
  public static async testConnection(): Promise<{ success: boolean; message: string; rateLimit?: number }> {
    try {
      const startTime = Date.now();
      const response = await this.fetchVulnerabilities({ resultsPerPage: 1 });
      const endTime = Date.now();
      
      return {
        success: true,
        message: `NVD API connection successful. Found ${response.totalResults} total vulnerabilities.`,
        rateLimit: endTime - startTime
      };
    } catch (error) {
      return {
        success: false,
        message: `NVD API connection failed: ${(error as Error).message}`
      };
    }
  }
}
