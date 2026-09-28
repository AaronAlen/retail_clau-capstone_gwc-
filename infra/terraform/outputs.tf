output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_backend_service" {
  value = aws_ecs_service.backend.name
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "aws_region" {
  value = var.aws_region
}

output "how_to_get_backend_public_ip" {
  value = "Run: aws ecs list-tasks --cluster ${aws_ecs_cluster.main.name} --service-name ${aws_ecs_service.backend.name} to see the running task, and check ECS Console -> Tasks -> Public IP (Port 5000)"
}
