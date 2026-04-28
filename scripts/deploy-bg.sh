#!/bin/bash
set -e

# Default to latest if no tag provided
IMAGE_TAG=${1:-latest}
SERVICE="teachlink-backend-service"

# Identify the currently active environment
echo "Checking currently active environment..."
ACTIVE_COLOR=$(kubectl get svc $SERVICE -o=jsonpath='{.spec.selector.color}' 2>/dev/null || echo "blue")

if [ "$ACTIVE_COLOR" = "blue" ]; then
    IDLE_COLOR="green"
else
    IDLE_COLOR="blue"
fi

echo "Active environment is $ACTIVE_COLOR. Deploying to $IDLE_COLOR..."

# Update image (if testing a new image)
# kubectl set image deployment/teachlink-backend-$IDLE_COLOR teachlink-backend=your-dockerhub-username/teachlink-backend:$IMAGE_TAG

# Rollout restart to apply changes and deploy the inactive environment
kubectl rollout restart deployment/teachlink-backend-$IDLE_COLOR
kubectl rollout status deployment/teachlink-backend-$IDLE_COLOR

echo "Pods for $IDLE_COLOR are ready."
echo "Switching traffic to $IDLE_COLOR environment..."

# Patch the service to route traffic to the newly deployed environment
kubectl patch svc $SERVICE -p "{\"spec\": {\"selector\": {\"color\": \"$IDLE_COLOR\"}}}"

echo "Deployment completed. $IDLE_COLOR is now the active environment."
