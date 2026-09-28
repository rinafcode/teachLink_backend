{{- define "teachlink-backend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "teachlink-backend.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" (include "teachlink-backend.name" .) .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "teachlink-backend.labels" -}}
helm.sh/chart: {{ include "teachlink-backend.chart" . }}
app.kubernetes.io/name: {{ include "teachlink-backend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "teachlink-backend.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version -}}
{{- end -}}

{{- define "teachlink-backend.env" -}}
{{- range $index, $env := .Values.env }}
- name: {{ $env.name }}
  value: {{ $env.value | quote }}
{{- end -}}
{{- end -}}
