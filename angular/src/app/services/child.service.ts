// angular/src/app/services/child.service.ts
// Servicio Angular que consume los endpoints de niños y dashboard
import { Injectable }          from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable }          from 'rxjs';
import { map }                 from 'rxjs/operators';
import { environment }         from '../../environments/environment';

export interface ChildProfile {
  childId:       string;
  nickname:      string;
  ageRange:      string;
  avatarCode:    string;
  currentXp:     number;
  streakDays:    number;
  levelNumber:   number;
  levelName:     string;
  levelBadge:    string;
  xpToNextLevel: number;
}

export interface DailySummary {
  summaryDate:         string;
  xpGained:            number;
  challengesCompleted: number;
  habitsCompleted:     number;
  habitsTotal:         number;
  habitsPct:           number;
  screenTimeMinutes:   number;
  screenLimitExceeded: boolean;
  streakDaysAtDate:    number;
}

export interface HabitLog {
  logId:          string;
  habitId:        string;
  habitName:      string;
  iconCode:       string;
  category:       string;
  targetValue:    number;
  targetUnit:     string;
  valueAchieved:  number;
  isCompleted:    boolean;
  xpEarned:       number;
  logDate:        string;
}

@Injectable({ providedIn: 'root' })
export class ChildService {

  private readonly API = `${environment.apiUrl}/children`;

  constructor(private http: HttpClient) {}

  // ── Perfiles ───────────────────────────────────────────────────────────────
  getChildren(): Observable<ChildProfile[]> {
    return this.http.get<{ data: ChildProfile[] }>(this.API)
      .pipe(map(r => r.data));
  }

  getChild(childId: string): Observable<ChildProfile> {
    return this.http.get<{ data: ChildProfile }>(`${this.API}/${childId}`)
      .pipe(map(r => r.data));
  }

  createChild(payload: {
    username: string; password: string;
    nickname: string; ageRange: string; avatarCode?: string;
  }): Observable<ChildProfile> {
    return this.http.post<{ data: ChildProfile }>(this.API, payload)
      .pipe(map(r => r.data));
  }

  updateChild(childId: string, updates: Partial<{ nickname: string; avatar_code: string }>) {
    return this.http.patch<{ data: ChildProfile }>(`${this.API}/${childId}`, updates)
      .pipe(map(r => r.data));
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  getDashboard(childId: string, date?: string): Observable<DailySummary> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<{ data: DailySummary }>(`${this.API}/${childId}/dashboard`, { params })
      .pipe(map(r => r.data));
  }

  getWeeklyTrend(childId: string, weeks = 8) {
    const params = new HttpParams().set('weeks', weeks.toString());
    return this.http.get<{ data: any[] }>(`${this.API}/${childId}/trend`, { params })
      .pipe(map(r => r.data));
  }

  // ── Hábitos ────────────────────────────────────────────────────────────────
  getHabitLogs(childId: string, date: string): Observable<HabitLog[]> {
    const params = new HttpParams().set('date', date);
    return this.http.get<{ data: HabitLog[] }>(`${this.API}/${childId}/habits`, { params })
      .pipe(map(r => r.data));
  }

  logHabit(childId: string, payload: {
    habitId: string; logDate: string;
    valueAchieved?: number; isCompleted?: boolean; source?: string;
  }) {
    return this.http.post<{ data: HabitLog }>(`${this.API}/${childId}/habits`, payload)
      .pipe(map(r => r.data));
  }

  getMonthlyCompliance(childId: string, year: number, month: number) {
    const params = new HttpParams()
      .set('year', year.toString()).set('month', month.toString());
    return this.http.get<{ data: any[] }>(`${this.API}/${childId}/habits/compliance`, { params })
      .pipe(map(r => r.data));
  }

  // ── Retos ──────────────────────────────────────────────────────────────────
  getChallenges(childId: string, status?: string) {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<{ data: any[] }>(`${this.API}/${childId}/challenges`, { params })
      .pipe(map(r => r.data));
  }

  assignChallenge(childId: string, challengeId: string) {
    return this.http.post<{ data: any }>(`${this.API}/${childId}/challenges`, { challengeId })
      .pipe(map(r => r.data));
  }

  updateChallengeStatus(childId: string, childChallengeId: string, status: string) {
    return this.http.patch<{ data: any }>(
      `${this.API}/${childId}/challenges/${childChallengeId}`, { status }
    ).pipe(map(r => r.data));
  }
}
