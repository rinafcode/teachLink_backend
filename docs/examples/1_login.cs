using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class LoginExample {
    public static async Task Login() {
        using (var client = new HttpClient()) {
            client.BaseAddress = new Uri("http://localhost:3000");
            
            var content = new StringContent(
                JsonSerializer.Serialize({"email":"learner@example.com","password":"Password123!"}),
                Encoding.UTF8,
                "application/json"
            );

            var response = await client.postAsync("/auth/login", content);
            
            var result = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Response: " + result);
        }
    }

    public static void Main() {
        Login().Wait();
    }
}