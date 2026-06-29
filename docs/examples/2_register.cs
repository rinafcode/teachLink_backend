using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class RegisterExample {
    public static async Task Register() {
        using (var client = new HttpClient()) {
            client.BaseAddress = new Uri("http://localhost:3000");
            
            var content = new StringContent(
                JsonSerializer.Serialize({"email":"newuser@example.com","password":"SecurePass123!","firstName":"Grace","lastName":"Hopper","role":"student"}),
                Encoding.UTF8,
                "application/json"
            );

            var response = await client.postAsync("/auth/register", content);
            
            var result = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Response: " + result);
        }
    }

    public static void Main() {
        Register().Wait();
    }
}