# Advanced A/B Testing Framework

This module provides a comprehensive A/B testing framework with statistical analysis and automated decision-making capabilities.

## Features

- **Experiment Management**: Create, configure, and manage A/B tests and multivariate experiments
- **Statistical Analysis**: Calculate statistical significance, confidence intervals, and effect sizes
- **Automated Decision Making**: Auto-select winners based on statistical criteria
- **Traffic Allocation**: Dynamic traffic distribution with auto-allocation capabilities
- **Comprehensive Reporting**: Detailed analytics and performance comparison reports
- **Multi-variant Support**: A/B testing, multivariate testing, and multi-armed bandit experiments

## Architecture

### Core Components

1. **ABTestingModule**: Main module orchestrating all A/B testing functionality
2. **ABTestingService**: Core service for experiment lifecycle management
3. **ExperimentService**: Handles experiment configuration and variant management
4. **StatisticalAnalysisService**: Performs statistical calculations and significance testing
5. **AutomatedDecisionService**: Implements automated winner selection and traffic allocation
6. **ABTestingReportsService**: Generates comprehensive reports and analytics
7. **ABTestingController**: Exposes REST API endpoints for all functionality

### Data Model

The framework uses four main entities:

- **Experiment**: Core experiment configuration and metadata
- **ExperimentVariant**: Individual test variants with configurations
- **ExperimentMetric**: Metrics to track and measure
- **VariantMetric**: Performance data for each variant

## API Endpoints

### Experiment Management
- `GET /ab-testing/experiments` - List all experiments
- `GET /ab-testing/experiments/:id` - Get experiment details
- `POST /ab-testing/experiments` - Create new experiment
- `PUT /ab-testing/experiments/:id` - Update experiment
- `DELETE /ab-testing/experiments/:id` - Delete experiment

### Experiment Lifecycle
- `POST /ab-testing/experiments/:id/start` - Start experiment
- `POST /ab-testing/experiments/:id/stop` - Stop experiment
- `POST /ab-testing/experiments/:id/pause` - Pause experiment
- `POST /ab-testing/experiments/:id/resume` - Resume experiment
- `POST /ab-testing/experiments/:id/archive` - Archive experiment

### Variant Management
- `POST /ab-testing/experiments/:id/variants` - Add variant to experiment
- `DELETE /ab-testing/variants/:id` - Remove variant
- `PUT /ab-testing/experiments/:id/traffic-allocation` - Update traffic allocation

### Analysis and Results
- `GET /ab-testing/experiments/:id/results` - Get experiment results
- `GET /ab-testing/experiments/:id/statistical-analysis` - Perform statistical analysis
- `GET /ab-testing/experiments/:id/effect-size` - Calculate effect size
- `GET /ab-testing/experiments/:id/decision-recommendations` - Get decision recommendations

### Automated Features
- `POST /ab-testing/experiments/:id/auto-select-winner` - Auto-select winner
- `POST /ab-testing/experiments/:id/auto-allocate-traffic` - Auto-allocate traffic

### Reporting
- `GET /ab-testing/reports/dashboard` - Get dashboard summary
- `GET /ab-testing/reports/experiment/:id` - Generate detailed experiment report
- `GET /ab-testing/reports/performance-comparison` - Performance comparison report
- `GET /ab-testing/reports/timeline` - Experiment timeline
- `GET /ab-testing/reports/experiment/:id/export` - Export data as CSV

### User Assignment
- `GET /ab-testing/experiments/:id/assign-user/:userId` - Assign user to variant

## Usage Examples

### Creating an A/B Test

```typescript
const experimentData = {
  name: "Homepage CTA Button Test",
  description: "Testing different CTA button colors",
  type: "a_b_test",
  startDate: new Date(),
  trafficAllocation: 1.0,
  autoAllocateTraffic: false,
  confidenceLevel: 95,
  minimumSampleSize: 1000,
  hypothesis: "Red CTA button will increase conversion rate",
  variants: [
    {
      name: "Control",
      description: "Blue CTA button",
      configuration: { color: "blue" },
      isControl: true
    },
    {
      name: "Variant A",
      description: "Red CTA button",
      configuration: { color: "red" },
      isControl: false
    }
  ],
  metrics: [
    {
      name: "Conversion Rate",
      description: "Percentage of users who click CTA",
      type: "conversion",
      isPrimary: true
    }
  ]
};

// Create the experiment
const experiment = await abTestingService.createExperiment(experimentData);

// Start the experiment
await abTestingService.startExperiment(experiment.id);
```

### Analyzing Results

```typescript
// Get statistical analysis
const analysis = await statisticalAnalysisService.calculateStatisticalSignificance(experimentId);

// Check if results are significant
if (analysis.statisticallySignificant) {
  // Auto-select winner
  const decision = await automatedDecisionService.autoSelectWinner(experimentId);
  
  if (decision.decision === 'winner_selected') {
    console.log(`Winner: ${decision.winnerName}`);
    console.log(`Effect size: ${decision.effectSize}`);
  }
}

// Generate detailed report
const report = await reportsService.generateExperimentReport(experimentId);
```

### Traffic Allocation

```typescript
// Manual traffic allocation
const allocations = {
  [variant1Id]: 0.5,  // 50% traffic
  [variant2Id]: 0.3,  // 30% traffic
  [variant3Id]: 0.2   // 20% traffic
};

await experimentService.updateTrafficAllocation(experimentId, allocations);

// Auto-allocate based on performance
await automatedDecisionService.autoAllocateTraffic(experimentId);
```

## Statistical Methods

The framework implements industry-standard statistical methods:

- **Z-test for proportions**: For conversion rate comparisons
- **Confidence intervals**: 90%, 95%, and 99% confidence levels
- **P-value calculations**: Statistical significance testing
- **Cohen's d**: Effect size measurement
- **Power analysis**: Sample size determination

## Best Practices

1. **Define clear hypotheses** before starting experiments
2. **Ensure adequate sample sizes** for statistical validity
3. **Run experiments for sufficient duration** (minimum recommended: 7 days)
4. **Monitor for statistical significance** before making decisions
5. **Consider multiple metrics** including business impact
6. **Document all findings** for future reference
7. **Archive completed experiments** to maintain clean data

## Configuration Options

### Experiment Types
- `A_B_TEST`: Traditional A/B testing with control and variants
- `MULTIVARIATE`: Test multiple variables simultaneously
- `MULTI_ARMED_BANDIT`: Dynamic allocation based on performance

### Statistical Parameters
- **Confidence Level**: 90%, 95%, or 99% (default: 95%)
- **Minimum Sample Size**: Per variant (default: 100)
- **Effect Size Threshold**: Minimum detectable effect (default: 0.1)

### Automation Settings
- **Auto Traffic Allocation**: Enable/disable dynamic allocation
- **Winner Selection Criteria**: Customizable decision thresholds
- **Duration Thresholds**: Minimum experiment duration requirements

## Error Handling

The framework provides comprehensive error handling:
- Validation of experiment configurations
- Sample size and duration checks
- Statistical calculation safeguards
- Graceful handling of edge cases

## Security Considerations

- Experiments should be reviewed before going live
- Access to experiment controls should be restricted
- Results should be validated before implementation
- Consider privacy implications of user segmentation